//! Three in-process Malachite validators on one allowlist.
//!
//! The network engine depends on libp2p, so this module ferries the signed
//! consensus messages Malachite already publishes (`SignedConsensusMsg`, the
//! vote or proposal `ConsensusMsg` plus its signature) between three
//! `State` values in this process. A commit is still only `Effect::Decide`.
//! No port is opened. Marking the current leader absent stops that state.
//! The other two validators are still a majority of the original three.

use std::collections::VecDeque;

use informalsystems_malachitebft_core_consensus::{
    process, Error as ConsensusError, Input, Params, SignedConsensusMsg, State, ValuePayload,
};
use informalsystems_malachitebft_core_types::{
    Context, Height, Round, ThresholdParam, ThresholdParams, Timeout, TimeoutKind, Validator,
    ValidatorSet,
};
use informalsystems_malachitebft_signing_ed25519::{Ed25519, PrivateKey};
use rand::rngs::OsRng;

use crate::context::{allowlist_validator_set, leader_address, seed_roller_address};
use crate::{
    handle_effect, BatchRoot, Committed, GenesisSet, OrderAddr, OrderCtx, OrderError, OrderHeight,
};

fn hex_root(root: &[u8; 32]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(64);
    for byte in root {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0xf) as usize] as char);
    }
    out
}

/// Strict majority: more than half the voting power.
///
/// For three votes, one signer fails `is_met` and two succeed. For one vote,
/// the single signer still meets it, so a genesis of one keeps committing.
pub fn majority_threshold() -> ThresholdParams {
    ThresholdParams {
        quorum: ThresholdParam::new(1, 2),
        honest: ThresholdParam::F_PLUS_ONE,
    }
}

/// One allowlist entry and whether this process has seen it speak.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PeerView {
    pub address: OrderAddr,
    pub heard: bool,
    /// `false` after the harness stops that validator. The allowlist still has three keys.
    pub present: bool,
}

/// A proposal the leader published before a majority decided it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ProposalOnly {
    pub height: u64,
    pub root: [u8; 32],
    pub proposer: OrderAddr,
}

/// The leader a player session is following.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PlayerSession {
    pub leader: OrderAddr,
}

impl PlayerSession {
    pub fn connect(leader: OrderAddr) -> Self {
        Self { leader }
    }

    /// Point the session at the directory's leader.
    ///
    /// The returned value is the old leader address and the new leader address.
    pub fn reconnect(&mut self, directory_leader: OrderAddr) -> Reconnect {
        let old_leader = self.leader;
        self.leader = directory_leader;
        Reconnect {
            old_leader,
            new_leader: directory_leader,
        }
    }
}

/// Old leader address and new leader address.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Reconnect {
    pub old_leader: OrderAddr,
    pub new_leader: OrderAddr,
}

impl std::fmt::Display for Reconnect {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} {}", self.old_leader, self.new_leader)
    }
}

struct Replica {
    key: PrivateKey,
    address: OrderAddr,
    state: State<OrderCtx>,
    queue: VecDeque<Input<OrderCtx>>,
    present: bool,
    heard: bool,
}

/// Three Ed25519 identities and three Malachite states.
///
/// The keys are generated in memory. They are not `LOK_OWNER_KEY`,
/// `PRIVATE_KEY`, or the listing key.
pub struct AllowlistOrderer {
    replicas: Vec<Replica>,
    validators: GenesisSet,
    last_commit: Option<Committed>,
    certified: Vec<Committed>,
    uncertified: Option<ProposalOnly>,
    /// Set when the previous directory leader was removed. Lookup keeps this address.
    directory_leader: Option<OrderAddr>,
}

impl AllowlistOrderer {
    /// All three replicas present. Majority is 2 of 3.
    pub fn generate() -> Self {
        Self::with_signers([true, true, true])
    }

    /// `present[i] == false` is a missing peer: that state does not sign.
    pub fn with_signers(present: [bool; 3]) -> Self {
        let keys = [
            Ed25519::generate_keypair(OsRng),
            Ed25519::generate_keypair(OsRng),
            Ed25519::generate_keypair(OsRng),
        ];
        let validators = allowlist_validator_set(&keys);
        let thresholds = majority_threshold();
        let replicas = keys
            .into_iter()
            .zip(present)
            .map(|(key, is_present)| {
                let public_key = key.public_key();
                let address = OrderAddr(*public_key.as_bytes());
                let params = Params {
                    initial_height: OrderHeight::ZERO,
                    initial_validator_set: validators.clone(),
                    address,
                    threshold_params: thresholds,
                    value_payload: ValuePayload::ProposalOnly,
                };
                Replica {
                    key,
                    address,
                    state: State::new(OrderCtx, params, 16),
                    queue: VecDeque::new(),
                    present: is_present,
                    heard: false,
                }
            })
            .collect();
        Self {
            replicas,
            validators,
            last_commit: None,
            certified: Vec::new(),
            uncertified: None,
            directory_leader: None,
        }
    }

    pub fn validator_set(&self) -> &GenesisSet {
        &self.validators
    }

    pub fn last_commit(&self) -> Option<Committed> {
        self.last_commit
    }

    pub fn leader_at(&self, height: u64) -> OrderAddr {
        leader_address(&self.validators, height)
    }

    pub fn seed_roller_at(&self, height: u64) -> OrderAddr {
        seed_roller_address(&self.validators, height)
    }

    pub fn peers(&self) -> Vec<PeerView> {
        self.replicas
            .iter()
            .map(|replica| PeerView {
                address: replica.address,
                heard: replica.heard,
                present: replica.present,
            })
            .collect()
    }

    /// Decided batches, in order. A proposal that never reached `Effect::Decide` is absent.
    pub fn certified_prefix(&self) -> &[Committed] {
        &self.certified
    }

    /// The last proposal a leader published without a majority decision.
    pub fn uncertified(&self) -> Option<ProposalOnly> {
        self.uncertified
    }

    /// Height of the next batch. Zero before the first decision.
    pub fn open_height(&self) -> u64 {
        self.certified
            .last()
            .map(|commit| commit.height.saturating_add(1))
            .unwrap_or(0)
    }

    /// Directory entry a session follows.
    pub fn lookup_leader(&self) -> OrderAddr {
        if let Some(leader) = self.directory_leader {
            return leader;
        }
        leader_address(&self.validators, self.open_height())
    }

    /// Mark the directory leader absent and stop its state.
    ///
    /// The allowlist stays three keys. The directory then names the next present replica.
    pub fn kill_leader(&mut self) -> OrderAddr {
        let dead = self.lookup_leader();
        for replica in &mut self.replicas {
            if replica.address == dead {
                replica.present = false;
                replica.queue.clear();
            }
        }
        self.directory_leader = Some(self.successor(dead));
        dead
    }

    /// The current leader publishes `root`. The proposal is not ferried and is not decided.
    pub fn propose_only(&mut self, height: u64, root: [u8; 32]) -> Result<ProposalOnly, OrderError> {
        if height != self.open_height() {
            return Err(OrderError::NoDecision { height });
        }
        let proposer = leader_address(&self.validators, height);
        let Some(index) = self
            .replicas
            .iter()
            .position(|replica| replica.present && replica.address == proposer)
        else {
            return Err(OrderError::NoDecision { height });
        };

        self.replicas[index].queue.clear();
        self.replicas[index].queue.push_back(Input::StartHeight(
            OrderHeight(height),
            self.validators.clone(),
        ));

        let mut pending = Some(BatchRoot(root));
        let mut decided: Option<Committed> = None;
        let mut proposed: Option<ProposalOnly> = None;
        let mut steps = 0u32;
        while proposed.is_none() {
            if self.replicas[index].queue.is_empty() || steps > 64 {
                break;
            }
            steps += 1;
            let mut outbound = Vec::new();
            let mut scheduled = Vec::new();
            drive_replica(
                &mut self.replicas[index],
                &self.validators,
                &mut pending,
                &mut decided,
                &mut outbound,
                &mut scheduled,
            )?;
            for msg in outbound {
                if let SignedConsensusMsg::Proposal(signed) = msg {
                    if signed.message.value.0 == root && signed.message.address == proposer {
                        proposed = Some(ProposalOnly {
                            height,
                            root,
                            proposer,
                        });
                    }
                }
            }
        }

        if decided.is_some() {
            return Err(OrderError::Consensus(
                "a single leader publish met Effect::Decide".into(),
            ));
        }
        let proposed = proposed.ok_or(OrderError::NoDecision { height })?;
        self.uncertified = Some(proposed);
        Ok(proposed)
    }

    fn successor(&self, dead: OrderAddr) -> OrderAddr {
        let count = ValidatorSet::count(&self.validators);
        let dead_index = (0..count)
            .find(|index| address_at(&self.validators, *index) == dead)
            .expect("leader is in the allowlist");
        for step in 1..count {
            let index = (dead_index + step) % count;
            let address = address_at(&self.validators, index);
            if self
                .replicas
                .iter()
                .any(|replica| replica.present && replica.address == address)
            {
                return address;
            }
        }
        dead
    }

    /// Clock skew of the local harness. The three states share this process clock.
    pub fn clock_skew(&self) -> i64 {
        0
    }

    /// Gnosis anchor is a later gate. This phase has no anchored height.
    pub fn last_anchored_height(&self) -> Option<u64> {
        None
    }

    pub fn status_json(&self) -> String {
        let certified = self.last_commit.map(|commit| commit.height);
        let at = certified.unwrap_or(0);
        let peers: Vec<_> = self
            .peers()
            .into_iter()
            .map(|peer| {
                serde_json::json!({
                    "address": peer.address.to_string(),
                    "heard": peer.heard,
                    "present": peer.present,
                })
            })
            .collect();
        let committed = self.last_commit;
        serde_json::json!({
            "committed": committed.is_some(),
            "height": match certified {
                Some(height) => serde_json::Value::from(height),
                None => serde_json::Value::Null,
            },
            "root": match committed {
                Some(commit) => serde_json::Value::String(hex_root(&commit.root)),
                None => serde_json::Value::Null,
            },
            "signatures": match committed {
                Some(commit) => serde_json::Value::from(commit.signatures),
                None => serde_json::Value::Null,
            },
            "lastCertifiedHeight": match certified {
                Some(height) => serde_json::Value::from(height),
                None => serde_json::Value::Null,
            },
            "lastAnchoredHeight": serde_json::Value::Null,
            "clockSkew": self.clock_skew(),
            "peers": peers,
            "leader": self.leader_at(at).to_string(),
            "directoryLeader": self.lookup_leader().to_string(),
            "seedRoller": self.seed_roller_at(at).to_string(),
        })
        .to_string()
    }

    /// Run one height. Fewer than two signing replicas leaves the batch provisional.
    ///
    /// The caller does not wait on a timeout. Messages already queued are ferried
    /// until the states go idle or one of them yields `Effect::Decide`.
    pub fn commit(&mut self, height: u64, root: [u8; 32]) -> Result<Committed, OrderError> {
        let order_height = OrderHeight(height);
        for replica in &mut self.replicas {
            replica.queue.clear();
            if replica.present {
                replica
                    .queue
                    .push_back(Input::StartHeight(order_height, self.validators.clone()));
            }
        }

        let mut pending = Some(BatchRoot(root));
        let mut decided: Option<Committed> = None;
        let mut steps = 0u32;
        loop {
            if steps > 2048 {
                break;
            }
            let mut progress = false;
            for i in 0..self.replicas.len() {
                if self.replicas[i].queue.is_empty() {
                    continue;
                }
                progress = true;
                steps += 1;
                let mut outbound = Vec::new();
                let mut scheduled = Vec::new();
                drive_replica(
                    &mut self.replicas[i],
                    &self.validators,
                    &mut pending,
                    &mut decided,
                    &mut outbound,
                    &mut scheduled,
                )?;
                if decided.is_none() {
                    let fire: Vec<Timeout> = scheduled
                        .into_iter()
                        .filter(|timeout| {
                            matches!(
                                timeout.kind,
                                TimeoutKind::Propose | TimeoutKind::Prevote | TimeoutKind::Precommit
                            ) && !proposer_is_present(
                                &self.replicas,
                                &self.validators,
                                order_height,
                                timeout.round,
                            )
                        })
                        .collect();
                    for timeout in fire {
                        let replica = &mut self.replicas[i];
                        let queued = replica.queue.iter().any(|input| {
                            matches!(input, Input::TimeoutElapsed(queued) if queued == &timeout)
                        });
                        if replica.present && !queued {
                            replica.queue.push_back(Input::TimeoutElapsed(timeout));
                        }
                    }
                }
                if outbound.is_empty() {
                    if steps > 2048 {
                        break;
                    }
                    continue;
                }
                self.replicas[i].heard = true;
                for msg in outbound {
                    for j in 0..self.replicas.len() {
                        if j != i && self.replicas[j].present {
                            self.replicas[j]
                                .queue
                                .push_back(signed_to_input(msg.clone()));
                        }
                    }
                }
                if steps > 2048 {
                    break;
                }
            }
            if !progress {
                break;
            }
            if decided.is_some() && self.replicas.iter().all(|replica| replica.queue.is_empty()) {
                break;
            }
        }

        let committed = decided.ok_or(OrderError::NoDecision { height })?;
        if self.directory_leader.is_some() {
            self.directory_leader = Some(committed.proposer);
        }
        self.certified.push(committed);
        self.last_commit = Some(committed);
        Ok(committed)
    }
}

fn signed_to_input(msg: SignedConsensusMsg<OrderCtx>) -> Input<OrderCtx> {
    match msg {
        SignedConsensusMsg::Vote(vote) => Input::Vote(vote),
        SignedConsensusMsg::Proposal(proposal) => Input::Proposal(proposal),
    }
}

fn address_at(set: &GenesisSet, index: usize) -> OrderAddr {
    *Validator::address(ValidatorSet::get_by_index(set, index).expect("allowlist index"))
}

fn proposer_is_present(
    replicas: &[Replica],
    validators: &GenesisSet,
    height: OrderHeight,
    round: Round,
) -> bool {
    let proposer = OrderCtx.select_proposer(validators, height, round);
    let address = *Validator::address(proposer);
    replicas
        .iter()
        .any(|replica| replica.present && replica.address == address)
}

fn drive_replica(
    replica: &mut Replica,
    validators: &GenesisSet,
    pending: &mut Option<BatchRoot>,
    decided: &mut Option<Committed>,
    outbound: &mut Vec<SignedConsensusMsg<OrderCtx>>,
    scheduled: &mut Vec<Timeout>,
) -> Result<(), OrderError> {
    let Some(input) = replica.queue.pop_front() else {
        return Ok(());
    };
    let mut followups = Vec::new();
    let key = replica.key.clone();
    let address = replica.address;
    let step: Result<(), ConsensusError<OrderCtx>> = process!(
        input: input,
        state: &mut replica.state,
        metrics: &(),
        with: effect => handle_effect(
            effect,
            &key,
            &address,
            validators,
            pending,
            decided,
            &mut followups,
            outbound,
            scheduled,
        )
    );
    step.map_err(|err: ConsensusError<OrderCtx>| OrderError::Consensus(err.to_string()))?;
    for input in followups.into_iter().rev() {
        replica.queue.push_front(input);
    }
    Ok(())
}
