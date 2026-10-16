//! Application types for one in-process Malachite validator.
//!
//! The consensus algorithm stays in `informalsystems-malachitebft-core-consensus`.
//! These types only name the batch root, the height, and the genesis key.

use std::fmt;

use informalsystems_malachitebft_core_types::{
    Address, Context, Height, NilOrVal, Proposal, ProposalPart, Round, SignedExtension,
    SignedMessage,
    SigningProvider, SigningScheme, Validator, ValidatorSet, Value, ValueId, Vote, VoteType,
};
use informalsystems_malachitebft_signing_ed25519::{self as ed25519, Ed25519, PublicKey};

/// 32-byte batch next root. Its id is itself, so a commit certificate names the root.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct BatchRoot(pub [u8; 32]);

impl fmt::Display for BatchRoot {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for byte in self.0 {
            write!(f, "{byte:02x}")?;
        }
        Ok(())
    }
}

impl Value for BatchRoot {
    type Id = BatchRoot;

    fn id(&self) -> Self::Id {
        *self
    }
}

/// Consensus height. The sealed batch height is this number, including zero.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct OrderHeight(pub u64);

impl fmt::Display for OrderHeight {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Height for OrderHeight {
    const ZERO: Self = Self(0);
    const INITIAL: Self = Self(1);

    fn increment_by(&self, n: u64) -> Self {
        Self(self.0.saturating_add(n))
    }

    fn decrement_by(&self, n: u64) -> Option<Self> {
        self.0.checked_sub(n).map(Self)
    }

    fn as_u64(&self) -> u64 {
        self.0
    }
}

/// Ed25519 public key, used as the validator address.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct OrderAddr(pub [u8; 32]);

impl fmt::Display for OrderAddr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for byte in self.0 {
            write!(f, "{byte:02x}")?;
        }
        Ok(())
    }
}

impl Address for OrderAddr {}

/// Proposal parts are unused. A 32-byte root travels in the proposal value.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NoPart;

impl ProposalPart<OrderCtx> for NoPart {
    fn is_first(&self) -> bool {
        false
    }

    fn is_last(&self) -> bool {
        false
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OrderProposal {
    pub height: OrderHeight,
    pub round: Round,
    pub value: BatchRoot,
    pub pol_round: Round,
    pub address: OrderAddr,
}

impl Proposal<OrderCtx> for OrderProposal {
    fn height(&self) -> OrderHeight {
        self.height
    }

    fn round(&self) -> Round {
        self.round
    }

    fn value(&self) -> &BatchRoot {
        &self.value
    }

    fn take_value(self) -> BatchRoot {
        self.value
    }

    fn pol_round(&self) -> Round {
        self.pol_round
    }

    fn validator_address(&self) -> &OrderAddr {
        &self.address
    }
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct OrderVote {
    pub vote_type: VoteType,
    pub height: OrderHeight,
    pub round: Round,
    pub value: NilOrVal<BatchRoot>,
    pub address: OrderAddr,
    pub extension: Option<SignedExtension<OrderCtx>>,
}

impl Vote<OrderCtx> for OrderVote {
    fn height(&self) -> OrderHeight {
        self.height
    }

    fn round(&self) -> Round {
        self.round
    }

    fn value(&self) -> &NilOrVal<ValueId<OrderCtx>> {
        &self.value
    }

    fn take_value(self) -> NilOrVal<ValueId<OrderCtx>> {
        self.value
    }

    fn vote_type(&self) -> VoteType {
        self.vote_type
    }

    fn validator_address(&self) -> &OrderAddr {
        &self.address
    }

    fn extension(&self) -> Option<&SignedExtension<OrderCtx>> {
        self.extension.as_ref()
    }

    fn take_extension(&mut self) -> Option<SignedExtension<OrderCtx>> {
        self.extension.take()
    }

    fn extend(mut self, extension: SignedExtension<OrderCtx>) -> Self {
        self.extension = Some(extension);
        self
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GenesisValidator {
    address: OrderAddr,
    public_key: PublicKey,
    voting_power: u64,
}

impl Validator<OrderCtx> for GenesisValidator {
    fn address(&self) -> &OrderAddr {
        &self.address
    }

    fn public_key(&self) -> &<Ed25519 as SigningScheme>::PublicKey {
        &self.public_key
    }

    fn voting_power(&self) -> u64 {
        self.voting_power
    }
}

/// Genesis set. One validator, or the three-replica allowlist.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GenesisSet {
    validators: Vec<GenesisValidator>,
}

impl ValidatorSet<OrderCtx> for GenesisSet {
    fn count(&self) -> usize {
        self.validators.len()
    }

    fn total_voting_power(&self) -> u64 {
        self.validators.iter().map(|v| v.voting_power).sum()
    }

    fn get_by_address(&self, address: &OrderAddr) -> Option<&GenesisValidator> {
        self.validators.iter().find(|v| v.address == *address)
    }

    fn get_by_index(&self, index: usize) -> Option<&GenesisValidator> {
        self.validators.get(index)
    }
}

fn validator_from_key(key: &ed25519::PrivateKey) -> GenesisValidator {
    let public_key = key.public_key();
    let address = OrderAddr(*public_key.as_bytes());
    GenesisValidator {
        address,
        public_key,
        voting_power: 1,
    }
}

/// Build the one-validator set from an in-memory Ed25519 key.
pub fn genesis_validator_set(key: &ed25519::PrivateKey) -> (GenesisSet, OrderAddr) {
    let validator = validator_from_key(key);
    let address = validator.address;
    let set = GenesisSet {
        validators: vec![validator],
    };
    (set, address)
}

/// Exactly three in-memory Ed25519 identities.
///
/// Callers generate the keys. This does not read `LOK_OWNER_KEY`, `PRIVATE_KEY`,
/// or the listing key.
pub fn allowlist_validator_set(keys: &[ed25519::PrivateKey; 3]) -> GenesisSet {
    GenesisSet {
        validators: keys.iter().map(validator_from_key).collect(),
    }
}

/// Proposer Malachite selects at round 0 for this height.
pub fn leader_address(set: &GenesisSet, height: u64) -> OrderAddr {
    let proposer = OrderCtx.select_proposer(set, OrderHeight(height), Round::new(0));
    *Validator::address(proposer)
}

/// Seed roller for this height.
///
/// With one replica the roller is the leader. With three, the roller is the
/// next allowlisted replica after the leader, so the two addresses differ.
/// The epoch seed formula is unchanged; this only names who rolls it.
pub fn seed_roller_address(set: &GenesisSet, height: u64) -> OrderAddr {
    let count = ValidatorSet::count(set);
    let leader = leader_address(set, height);
    if count <= 1 {
        return leader;
    }
    let leader_index = (0..count)
        .find(|index| {
            Validator::address(ValidatorSet::get_by_index(set, *index).expect("leader index"))
                == &leader
        })
        .expect("leader is in the allowlist");
    let roller_index = (leader_index + 1) % count;
    *Validator::address(ValidatorSet::get_by_index(set, roller_index).expect("seed roller"))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OrderCtx;

impl Context for OrderCtx {
    type Address = OrderAddr;
    type Height = OrderHeight;
    type ProposalPart = NoPart;
    type Proposal = OrderProposal;
    type Validator = GenesisValidator;
    type ValidatorSet = GenesisSet;
    type Value = BatchRoot;
    type Vote = OrderVote;
    type Extension = ();
    type SigningScheme = Ed25519;

    fn select_proposer<'a>(
        &self,
        validator_set: &'a GenesisSet,
        height: OrderHeight,
        round: Round,
    ) -> &'a GenesisValidator {
        let count = validator_set.count();
        let index = if count == 0 {
            0
        } else {
            (height.as_u64().wrapping_add(u64::from(round.as_u32().unwrap_or(0))) as usize) % count
        };
        validator_set
            .get_by_index(index)
            .expect("genesis validator set is non-empty")
    }

    fn new_proposal(
        &self,
        height: OrderHeight,
        round: Round,
        value: BatchRoot,
        pol_round: Round,
        address: OrderAddr,
    ) -> OrderProposal {
        OrderProposal {
            height,
            round,
            value,
            pol_round,
            address,
        }
    }

    fn new_prevote(
        &self,
        height: OrderHeight,
        round: Round,
        value_id: NilOrVal<BatchRoot>,
        address: OrderAddr,
    ) -> OrderVote {
        OrderVote {
            vote_type: VoteType::Prevote,
            height,
            round,
            value: value_id,
            address,
            extension: None,
        }
    }

    fn new_precommit(
        &self,
        height: OrderHeight,
        round: Round,
        value_id: NilOrVal<BatchRoot>,
        address: OrderAddr,
    ) -> OrderVote {
        OrderVote {
            vote_type: VoteType::Precommit,
            height,
            round,
            value: value_id,
            address,
            extension: None,
        }
    }
}

/// Bytes covered by an Ed25519 consensus signature.
///
/// Certificate checks rebuild the vote with `Context::new_precommit` and verify
/// that encoding, so the extension is not part of the signed bytes.
pub fn vote_bytes(vote: &OrderVote) -> Vec<u8> {
    let mut out = Vec::with_capacity(16 + 32 + 32);
    out.extend_from_slice(b"lok-order-vote-v1");
    out.push(match vote.vote_type {
        VoteType::Prevote => 1,
        VoteType::Precommit => 2,
    });
    out.extend_from_slice(&vote.height.0.to_be_bytes());
    out.extend_from_slice(&vote.round.as_i64().to_be_bytes());
    match &vote.value {
        NilOrVal::Nil => out.push(0),
        NilOrVal::Val(id) => {
            out.push(1);
            out.extend_from_slice(&id.0);
        }
    }
    out.extend_from_slice(&vote.address.0);
    out
}

pub fn proposal_bytes(proposal: &OrderProposal) -> Vec<u8> {
    let mut out = Vec::with_capacity(16 + 8 + 8 + 8 + 32 + 32);
    out.extend_from_slice(b"lok-order-prop-v1");
    out.extend_from_slice(&proposal.height.0.to_be_bytes());
    out.extend_from_slice(&proposal.round.as_i64().to_be_bytes());
    out.extend_from_slice(&proposal.pol_round.as_i64().to_be_bytes());
    out.extend_from_slice(&proposal.value.0);
    out.extend_from_slice(&proposal.address.0);
    out
}

impl SigningProvider<OrderCtx> for ed25519::PrivateKey {
    fn sign_vote(&self, vote: OrderVote) -> SignedMessage<OrderCtx, OrderVote> {
        let signature = self.sign(&vote_bytes(&vote));
        SignedMessage::new(vote, signature)
    }

    fn verify_signed_vote(
        &self,
        vote: &OrderVote,
        signature: &<Ed25519 as SigningScheme>::Signature,
        public_key: &PublicKey,
    ) -> bool {
        public_key.verify(&vote_bytes(vote), signature).is_ok()
    }

    fn sign_proposal(&self, proposal: OrderProposal) -> SignedMessage<OrderCtx, OrderProposal> {
        let signature = self.sign(&proposal_bytes(&proposal));
        SignedMessage::new(proposal, signature)
    }

    fn verify_signed_proposal(
        &self,
        proposal: &OrderProposal,
        signature: &<Ed25519 as SigningScheme>::Signature,
        public_key: &PublicKey,
    ) -> bool {
        public_key
            .verify(&proposal_bytes(proposal), signature)
            .is_ok()
    }

    fn sign_proposal_part(&self, proposal_part: NoPart) -> SignedMessage<OrderCtx, NoPart> {
        let signature = self.sign(b"lok-order-part-v1");
        SignedMessage::new(proposal_part, signature)
    }

    fn verify_signed_proposal_part(
        &self,
        _proposal_part: &NoPart,
        signature: &<Ed25519 as SigningScheme>::Signature,
        public_key: &PublicKey,
    ) -> bool {
        public_key.verify(b"lok-order-part-v1", signature).is_ok()
    }

    fn sign_vote_extension(&self, extension: ()) -> SignedMessage<OrderCtx, ()> {
        let signature = self.sign(b"lok-order-ext-v1");
        SignedMessage::new(extension, signature)
    }

    fn verify_signed_vote_extension(
        &self,
        _extension: &(),
        signature: &<Ed25519 as SigningScheme>::Signature,
        public_key: &PublicKey,
    ) -> bool {
        public_key.verify(b"lok-order-ext-v1", signature).is_ok()
    }
}
