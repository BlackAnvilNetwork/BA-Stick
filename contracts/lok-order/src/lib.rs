//! In-process Malachite orderer.
//!
//! The published network engine (`informalsystems-malachitebft-engine` 0.5.0)
//! depends on libp2p. This crate drives `informalsystems-malachitebft-core-consensus`
//! 0.5.0 inside the process, so validators can commit on the GNU toolchain
//! without protoc or a second host. A genesis of one still commits at threshold
//! 1. The allowlist runs three states and ferries their consensus messages.
//! The TypeScript tick only submits a height and a 32-byte root. It does not
//! run a round. A commit is still only `Effect::Decide`. Killing the current
//! leader marks that validator absent. The other two are still a majority of
//! the original three, so they commit the next batch. A session reconnects
//! to the new leader.

mod allowlist;
mod context;

use std::collections::VecDeque;
use std::fmt;

use informalsystems_malachitebft_core_consensus::{
    process, ConsensusMsg, Effect, Error as ConsensusError, Input, LocallyProposedValue, Params,
    Resumable, SignedConsensusMsg, State, ValuePayload,
};
use informalsystems_malachitebft_core_types::{
    Context, Height, SigningProvider, SigningProviderExt, ThresholdParams, Timeout, Validator,
};
use informalsystems_malachitebft_signing_ed25519::{Ed25519, PrivateKey};
use rand::rngs::OsRng;

pub use allowlist::{
    majority_threshold, AllowlistOrderer, PeerView, PlayerSession, ProposalOnly, Reconnect,
};
pub use context::{
    allowlist_validator_set, genesis_validator_set, leader_address, seed_roller_address, BatchRoot,
    GenesisSet, OrderAddr, OrderCtx, OrderHeight,
};


/// A commit certificate Malachite produced for one proposed root.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Committed {
    pub height: u64,
    pub root: [u8; 32],
    pub signatures: usize,
    /// Proposer of the round that decided.
    pub proposer: OrderAddr,
}

#[derive(Debug)]
pub enum OrderError {
    Consensus(String),
    NoDecision { height: u64 },
}

impl fmt::Display for OrderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrderError::Consensus(reason) => write!(f, "malachite consensus: {reason}"),
            OrderError::NoDecision { height } => {
                write!(f, "no commit at height {height}; batch stays provisional")
            }
        }
    }
}

impl std::error::Error for OrderError {}

/// In-memory orderer. The signing key is generated for this process and is not
/// `LOK_OWNER_KEY`, `PRIVATE_KEY`, or the listing key.
pub struct GenesisOrderer {
    key: PrivateKey,
    validators: GenesisSet,
    state: State<OrderCtx>,
    last_commit: Option<Committed>,
}

impl GenesisOrderer {
    /// One Ed25519 key, one validator, voting power 1.
    pub fn generate() -> Self {
        let key = Ed25519::generate_keypair(OsRng);
        let (validators, address) = genesis_validator_set(&key);
        let params = Params {
            initial_height: <OrderHeight as Height>::ZERO,
            initial_validator_set: validators.clone(),
            address,
            threshold_params: ThresholdParams::default(),
            value_payload: ValuePayload::ProposalOnly,
        };
        let state = State::new(OrderCtx, params, 16);
        Self {
            key,
            validators,
            state,
            last_commit: None,
        }
    }

    pub fn validator_set(&self) -> &GenesisSet {
        &self.validators
    }

    /// Last certificate this process has. `None` until a round decides.
    pub fn last_commit(&self) -> Option<Committed> {
        self.last_commit
    }

    pub fn address(&self) -> OrderAddr {
        self.state.address().clone()
    }

    /// With one replica the seed roller is this validator.
    pub fn seed_roller(&self) -> OrderAddr {
        seed_roller_address(self.validator_set(), 0)
    }

    /// Run one height until Malachite decides, or return an error and leave the
    /// caller on the provisional path. Does not invent a commit.
    pub fn commit(&mut self, height: u64, root: [u8; 32]) -> Result<Committed, OrderError> {
        let address = self.address();
        let mut pending = Some(BatchRoot(root));
        let mut decided: Option<Committed> = None;
        let mut queue = VecDeque::new();
        queue.push_back(Input::StartHeight(
            OrderHeight(height),
            self.validators.clone(),
        ));

        let mut steps = 0u32;
        while let Some(input) = queue.pop_front() {
            steps += 1;
            if steps > 64 {
                break;
            }
            let mut followups = Vec::new();
            let mut outbound = Vec::new();
            let mut scheduled = Vec::new();
            let step: Result<(), ConsensusError<OrderCtx>> = process!(
                input: input,
                state: &mut self.state,
                metrics: &(),
                with: effect => handle_effect(
                    effect,
                    &self.key,
                    &address,
                    &self.validators,
                    &mut pending,
                    &mut decided,
                    &mut followups,
                    &mut outbound,
                    &mut scheduled,
                )
            );
            step.map_err(|err: ConsensusError<OrderCtx>| OrderError::Consensus(err.to_string()))?;
            queue.extend(followups);
            if decided.is_some() && queue.is_empty() {
                break;
            }
        }

        let committed = decided.ok_or(OrderError::NoDecision { height })?;
        self.last_commit = Some(committed);
        Ok(committed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use informalsystems_malachitebft_core_types::{ThresholdParams, ValidatorSet};

    #[test]
    fn genesis_of_one_commits_a_submitted_batch() {
        let thresholds = ThresholdParams::default();
        assert_eq!(thresholds.quorum.min_expected(1), 1);
        assert!(thresholds.quorum.is_met(1, 1));
        assert!(!thresholds.quorum.is_met(0, 1));

        let mut orderer = GenesisOrderer::generate();
        assert_eq!(orderer.validator_set().count(), 1);
        assert_eq!(orderer.validator_set().total_voting_power(), 1);
        assert_eq!(orderer.last_commit(), None);

        let mut root = [0u8; 32];
        root[0] = 0xab;
        let committed = orderer
            .commit(0, root)
            .expect("one validator at threshold 1 commits");
        assert_eq!(committed.height, 0);
        assert_eq!(committed.root, root);
        assert_eq!(committed.signatures, 1);
        assert_eq!(orderer.last_commit(), Some(committed));
    }

    #[test]
    fn an_undriven_batch_stays_provisional() {
        let orderer = GenesisOrderer::generate();
        assert_eq!(orderer.last_commit(), None);
    }
}

pub(crate) fn handle_effect(
    effect: Effect<OrderCtx>,
    key: &PrivateKey,
    address: &OrderAddr,
    validators: &GenesisSet,
    pending: &mut Option<BatchRoot>,
    decided: &mut Option<Committed>,
    followups: &mut Vec<Input<OrderCtx>>,
    outbound: &mut Vec<SignedConsensusMsg<OrderCtx>>,
    scheduled: &mut Vec<Timeout>,
) -> Result<informalsystems_malachitebft_core_consensus::Resume<OrderCtx>, &'static str> {
    Ok(match effect {
        Effect::PublishConsensusMsg(msg, resume) => {
            outbound.push(msg);
            resume.resume_with(())
        }
        Effect::ScheduleTimeout(timeout, resume) => {
            scheduled.push(timeout);
            resume.resume_with(())
        }
        Effect::ResetTimeouts(resume)
        | Effect::CancelAllTimeouts(resume)
        | Effect::CancelTimeout(_, resume)
        | Effect::StartRound(_, _, _, _, resume)
        | Effect::PublishLivenessMsg(_, resume)
        | Effect::RepublishVote(_, resume)
        | Effect::RepublishRoundCertificate(_, resume)
        | Effect::RestreamProposal(_, _, _, _, _, resume)
        | Effect::SyncValue(_, resume)
        | Effect::WalAppend(_, resume) => resume.resume_with(()),
        Effect::GetValidatorSet(_, resume) => resume.resume_with(Some(validators.clone())),
        Effect::GetValue(height, round, _timeout, resume) => {
            let proposer = OrderCtx.select_proposer(validators, height, round);
            if Validator::address(proposer) == address {
                if let Some(value) = pending.take() {
                    followups.push(Input::Propose(LocallyProposedValue::new(
                        height, round, value,
                    )));
                }
            }
            resume.resume_with(())
        }
        Effect::Decide(certificate, _extensions, resume) => {
            let proposer = *Validator::address(OrderCtx.select_proposer(
                validators,
                certificate.height,
                certificate.round,
            ));
            *decided = Some(Committed {
                height: Height::as_u64(&certificate.height),
                root: certificate.value_id.0,
                signatures: certificate.commit_signatures.len(),
                proposer,
            });
            resume.resume_with(())
        }
        Effect::SignVote(vote, resume) => resume.resume_with(key.sign_vote(vote)),
        Effect::SignProposal(proposal, resume) => resume.resume_with(key.sign_proposal(proposal)),
        Effect::VerifySignature(signed, public_key, resume) => {
            let valid = match &signed.message {
                ConsensusMsg::Vote(vote) => {
                    key.verify_signed_vote(vote, &signed.signature, &public_key)
                }
                ConsensusMsg::Proposal(proposal) => {
                    key.verify_signed_proposal(proposal, &signed.signature, &public_key)
                }
            };
            resume.resume_with(valid)
        }
        Effect::VerifyCommitCertificate(certificate, set, thresholds, resume) => {
            let result = key.verify_commit_certificate(&OrderCtx, &certificate, &set, thresholds);
            resume.resume_with(result)
        }
        Effect::VerifyPolkaCertificate(certificate, set, thresholds, resume) => {
            let result = key.verify_polka_certificate(&OrderCtx, &certificate, &set, thresholds);
            resume.resume_with(result)
        }
        Effect::VerifyRoundCertificate(certificate, set, thresholds, resume) => {
            let result = key.verify_round_certificate(&OrderCtx, &certificate, &set, thresholds);
            resume.resume_with(result)
        }
        Effect::ExtendVote(_, _, _, resume) => resume.resume_with(None),
        Effect::VerifyVoteExtension(_, _, _, _, _, resume) => resume.resume_with(Ok(())),
    })
}
