use std::collections::BTreeSet;

use ruint::aliases::U256 as WideU256;
use starknet_crypto::Felt;

use crate::codec::CanonicalEncode;
use crate::tree::FixedDepthTree;
use crate::types::{
    MmrCurrentFormulaAux, MmrFormulaInput, MmrPlanEntry, MmrSnapshotEntry, RankingCommitment,
    RankingEntry,
};

const MMR_SCALE: u128 = 1_000_000_000_000_000_000;
const FIXED_ONE: u128 = 1_u128 << 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MmrFormulaPolicy {
    pub formula_class_hash: Felt,
    pub distribution_mean: u16,
    pub spread_factor: u16,
    pub max_delta: u8,
    pub k_factor: u8,
    pub lobby_split_weight_scaled: u16,
    pub mean_regression_scaled: u16,
    pub min_players: u8,
    pub minimum_mmr: u128,
}

impl MmrFormulaPolicy {
    pub fn default_blitz() -> Self {
        Self {
            formula_class_hash: prototype_cubit_revision_id(),
            distribution_mean: 1_500,
            spread_factor: 450,
            max_delta: 45,
            k_factor: 50,
            lobby_split_weight_scaled: 2_500,
            mean_regression_scaled: 150,
            min_players: 6,
            minimum_mmr: 100,
        }
    }

    pub fn hash(&self) -> Felt {
        poseidon(&[
            domain("MMR_FORMULA_POLICY_V1"),
            self.formula_class_hash,
            Felt::from(self.distribution_mean),
            Felt::from(self.spread_factor),
            Felt::from(self.max_delta),
            Felt::from(self.k_factor),
            Felt::from(self.lobby_split_weight_scaled),
            Felt::from(self.mean_regression_scaled),
            Felt::from(self.min_players),
            Felt::from(self.minimum_mmr),
            Felt::from(64_u8),
            Felt::from(MMR_SCALE),
        ])
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MedianSource {
    LegacyStored = 1,
    LockedSnapshot = 2,
}

impl MedianSource {
    fn from_code(code: u8) -> Result<Self, MmrPlanError> {
        match code {
            1 => Ok(Self::LegacyStored),
            2 => Ok(Self::LockedSnapshot),
            _ => Err(MmrPlanError::MedianSource),
        }
    }

    fn formula_domains(self) -> (&'static str, &'static str) {
        match self {
            Self::LegacyStored => (
                "LEGACY_MMR_FORMULA_INPUTS_V1",
                "LEGACY_MMR_FORMULA_INPUT_V1",
            ),
            Self::LockedSnapshot => ("MMR_FORMULA_INPUTS_V1", "MMR_FORMULA_INPUT_V1"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MmrPlanWitness {
    pub ranking: RankingCommitment,
    pub ranking_entries: Vec<RankingEntry>,
    pub formula_inputs: Vec<MmrFormulaInput>,
    pub snapshots: Vec<MmrSnapshotEntry>,
    pub aux: MmrCurrentFormulaAux,
    pub policy: MmrFormulaPolicy,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MmrPlanJournal {
    pub sequence: u64,
    pub ranking: RankingCommitment,
    pub snapshot_commitment: Felt,
    pub plan_root: Felt,
    pub median: u128,
    pub module_aux_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MmrPlanClaim {
    pub sequence: u64,
    pub ranking: RankingCommitment,
    pub snapshot_commitment: Felt,
    pub plan_root: Felt,
    pub median: u128,
    pub module_aux_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MmrPlanOutput {
    pub journal: MmrPlanJournal,
    pub entries: Vec<MmrPlanEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MmrPlanError {
    ParticipantCount,
    FormulaPolicy,
    FormulaInputs,
    RankingOrder,
    Snapshot,
    MedianSource,
    Arithmetic,
    Tree,
}

pub fn execute_mmr_update_plan(
    sequence: u64,
    witness: &MmrPlanWitness,
) -> Result<MmrPlanOutput, MmrPlanError> {
    let median_source = validate_witness_shape(witness)?;
    validate_ranking_and_snapshot_rows(witness)?;
    validate_ranking_commitment(witness)?;
    let median = select_median(median_source, witness)?;
    let entries = build_plan_entries(witness, median)?;
    let journal = build_journal(sequence, median_source, witness, median, &entries)?;
    Ok(MmrPlanOutput { journal, entries })
}

pub fn hash_ranking_entry(entry: &RankingEntry) -> Felt {
    hash_encoded("RANKING_LEAF_V1", entry)
}

pub fn hash_formula_inputs(median_source: MedianSource, inputs: &[MmrFormulaInput]) -> Felt {
    let (list_domain, leaf_domain) = median_source.formula_domains();
    hash_counted_list(
        list_domain,
        inputs.iter().map(|input| hash_encoded(leaf_domain, input)),
    )
}

pub fn verify_mmr_plan_journal(claim: &MmrPlanClaim, journal: &MmrPlanJournal) -> bool {
    claim.sequence == journal.sequence
        && claim.ranking == journal.ranking
        && claim.snapshot_commitment == journal.snapshot_commitment
        && claim.plan_root == journal.plan_root
        && claim.median == journal.median
        && claim.module_aux_hash == journal.module_aux_hash
}

fn validate_witness_shape(witness: &MmrPlanWitness) -> Result<MedianSource, MmrPlanError> {
    let count = witness.ranking_entries.len();
    if count < witness.policy.min_players as usize
        || count > u16::MAX as usize
        || witness.formula_inputs.len() != count
        || witness.snapshots.len() != count
        || witness.aux.participant_count as usize != count
    {
        return Err(MmrPlanError::ParticipantCount);
    }
    if witness.aux.formula_policy_hash != witness.policy.hash() {
        return Err(MmrPlanError::FormulaPolicy);
    }
    let median_source = MedianSource::from_code(witness.aux.median_source)?;
    if witness.aux.formula_inputs_root
        != hash_formula_inputs(median_source, &witness.formula_inputs)
    {
        return Err(MmrPlanError::FormulaInputs);
    }
    Ok(median_source)
}

fn validate_ranking_and_snapshot_rows(witness: &MmrPlanWitness) -> Result<(), MmrPlanError> {
    let mut ranking_hashes = BTreeSet::new();
    let mut identities = BTreeSet::new();
    for (index, ((ranking, formula), snapshot)) in witness
        .ranking_entries
        .iter()
        .zip(&witness.formula_inputs)
        .zip(&witness.snapshots)
        .enumerate()
    {
        let ranking_hash = hash_ranking_entry(ranking);
        validate_formula_input(index, ranking, formula, ranking_hash)?;
        validate_snapshot_link(ranking, snapshot, ranking_hash)?;
        validate_rank_range(ranking, witness.ranking_entries.len())?;
        validate_row_uniqueness(snapshot, ranking_hash, &mut ranking_hashes, &mut identities)?;
        if index > 0 {
            validate_order(&witness.ranking_entries[index - 1], ranking)?;
        }
        validate_snapshot(snapshot)?;
    }
    Ok(())
}

fn validate_formula_input(
    index: usize,
    ranking: &RankingEntry,
    formula: &MmrFormulaInput,
    ranking_hash: Felt,
) -> Result<(), MmrPlanError> {
    if formula.ordinal_index as usize != index + 1
        || formula.ranking_entry_hash != ranking_hash
        || formula.formula_rank != ranking.rank
    {
        return Err(MmrPlanError::FormulaInputs);
    }
    Ok(())
}

fn validate_snapshot_link(
    ranking: &RankingEntry,
    snapshot: &MmrSnapshotEntry,
    ranking_hash: Felt,
) -> Result<(), MmrPlanError> {
    if snapshot.ranking_entry_hash != ranking_hash || snapshot.mmr_identity != ranking.recipient_l1
    {
        return Err(MmrPlanError::Snapshot);
    }
    Ok(())
}

fn validate_rank_range(
    ranking: &RankingEntry,
    participant_count: usize,
) -> Result<(), MmrPlanError> {
    if ranking.rank == 0 || ranking.rank as usize > participant_count {
        return Err(MmrPlanError::RankingOrder);
    }
    Ok(())
}

fn validate_row_uniqueness(
    snapshot: &MmrSnapshotEntry,
    ranking_hash: Felt,
    ranking_hashes: &mut BTreeSet<Felt>,
    identities: &mut BTreeSet<Felt>,
) -> Result<(), MmrPlanError> {
    if !ranking_hashes.insert(ranking_hash) || !identities.insert(snapshot.mmr_identity) {
        return Err(MmrPlanError::RankingOrder);
    }
    Ok(())
}

fn validate_order(previous: &RankingEntry, current: &RankingEntry) -> Result<(), MmrPlanError> {
    if current.rank < previous.rank {
        return Err(MmrPlanError::RankingOrder);
    }
    if current.rank == previous.rank
        && (current.recipient_l1, current.participation_id)
            <= (previous.recipient_l1, previous.participation_id)
    {
        return Err(MmrPlanError::RankingOrder);
    }
    Ok(())
}

fn validate_ranking_commitment(witness: &MmrPlanWitness) -> Result<(), MmrPlanError> {
    let ranking = &witness.ranking;
    let first = witness
        .ranking_entries
        .first()
        .ok_or(MmrPlanError::ParticipantCount)?;
    let last = witness
        .ranking_entries
        .last()
        .ok_or(MmrPlanError::ParticipantCount)?;
    let leaves = witness
        .ranking_entries
        .iter()
        .map(hash_ranking_entry)
        .collect::<Vec<_>>();
    let root = tree_root("RANKING_EMPTY_LEAF_V1", "RANKING_NODE_V1", &leaves)?;

    if ranking.root != root
        || ranking.participant_count as usize != witness.ranking_entries.len()
        || ranking.first_rank != first.rank
        || ranking.last_rank != last.rank
        || ranking.tie_break_policy_hash == Felt::ZERO
        || witness.ranking_entries.iter().any(|entry| {
            entry.game_id != ranking.game_id || entry.result_hash != ranking.result_hash
        })
    {
        return Err(MmrPlanError::RankingOrder);
    }
    Ok(())
}

fn validate_snapshot(snapshot: &MmrSnapshotEntry) -> Result<(), MmrPlanError> {
    let scaled = as_u128(&snapshot.starting_mmr_scaled).ok_or(MmrPlanError::Snapshot)?;
    let expected = if scaled == 0 {
        1_000
    } else {
        scaled / MMR_SCALE
    };
    if snapshot.starting_mmr_logical != expected {
        return Err(MmrPlanError::Snapshot);
    }
    Ok(())
}

fn select_median(
    median_source: MedianSource,
    witness: &MmrPlanWitness,
) -> Result<u128, MmrPlanError> {
    match median_source {
        MedianSource::LegacyStored if witness.aux.game_median > 0 => Ok(witness.aux.game_median),
        MedianSource::LockedSnapshot if witness.aux.game_median == 0 => {
            let mut values = witness
                .snapshots
                .iter()
                .map(|snapshot| (snapshot.starting_mmr_logical, snapshot.mmr_identity))
                .collect::<Vec<_>>();
            values.sort_unstable();
            let middle = values.len() / 2;
            if values.len() % 2 == 1 {
                Ok(values[middle].0)
            } else {
                values[middle - 1]
                    .0
                    .checked_add(values[middle].0)
                    .map(|sum| sum / 2)
                    .ok_or(MmrPlanError::Arithmetic)
            }
        }
        _ => Err(MmrPlanError::MedianSource),
    }
}

fn build_plan_entries(
    witness: &MmrPlanWitness,
    median: u128,
) -> Result<Vec<MmrPlanEntry>, MmrPlanError> {
    witness
        .formula_inputs
        .iter()
        .zip(&witness.snapshots)
        .map(|(formula, snapshot)| {
            let new_mmr = calculate_player_mmr(
                &witness.policy,
                snapshot.starting_mmr_logical,
                formula.formula_rank,
                witness.aux.participant_count,
                median,
                median,
            )?
            .max(witness.policy.minimum_mmr);
            Ok(MmrPlanEntry {
                ranking_entry_hash: formula.ranking_entry_hash,
                mmr_identity: snapshot.mmr_identity,
                starting_mmr_logical: snapshot.starting_mmr_logical,
                new_mmr_logical: new_mmr,
            })
        })
        .collect()
}

fn build_journal(
    sequence: u64,
    median_source: MedianSource,
    witness: &MmrPlanWitness,
    median: u128,
    entries: &[MmrPlanEntry],
) -> Result<MmrPlanJournal, MmrPlanError> {
    let plan_leaves = entries
        .iter()
        .map(|entry| hash_encoded("MMR_PLAN_LEAF_V1", entry))
        .collect::<Vec<_>>();
    let plan_root = tree_root("MMR_PLAN_EMPTY_LEAF_V1", "MMR_PLAN_NODE_V1", &plan_leaves)?;
    let snapshot_commitment = hash_counted_list(
        "MMR_SNAPSHOT_ENTRIES_V1",
        witness
            .snapshots
            .iter()
            .map(|entry| hash_encoded("MMR_SNAPSHOT_ENTRY_V1", entry)),
    );
    let module_aux_hash = match median_source {
        MedianSource::LegacyStored => poseidon(&[
            domain("LEGACY_MMR_MODULE_AUX_V1"),
            Felt::from(witness.aux.game_median),
            Felt::from(witness.aux.participant_count),
            witness.aux.formula_inputs_root,
            witness.aux.formula_policy_hash,
        ]),
        MedianSource::LockedSnapshot => hash_encoded("MMR_CURRENT_MODULE_AUX_V1", &witness.aux),
    };
    Ok(MmrPlanJournal {
        sequence,
        ranking: witness.ranking.clone(),
        snapshot_commitment,
        plan_root,
        median,
        module_aux_hash,
    })
}

fn tree_root(empty_domain: &str, node_domain: &str, leaves: &[Felt]) -> Result<Felt, MmrPlanError> {
    FixedDepthTree::new(32, domain(empty_domain), domain(node_domain))
        .and_then(|tree| tree.root(leaves))
        .map_err(|_| MmrPlanError::Tree)
}

fn hash_encoded<T: CanonicalEncode>(domain_name: &str, value: &T) -> Felt {
    let mut values = vec![domain(domain_name)];
    values.extend(value.encode());
    poseidon(&values)
}

fn hash_counted_list(domain_name: &str, leaves: impl IntoIterator<Item = Felt>) -> Felt {
    let leaves = leaves.into_iter().collect::<Vec<_>>();
    let mut values = Vec::with_capacity(leaves.len() + 2);
    values.push(domain(domain_name));
    values.push(Felt::from(leaves.len()));
    values.extend(leaves);
    poseidon(&values)
}

fn as_u128(value: &crate::types::U256) -> Option<u128> {
    (value.high == 0).then_some(value.low)
}

fn poseidon(values: &[Felt]) -> Felt {
    crate::poseidon_hash_many(values)
}

fn domain(name: &str) -> Felt {
    let selector = crate::schema_vector::hash_domain_selector(name)
        .unwrap_or_else(|| panic!("unregistered MMR domain: {name}"));
    Felt::from_hex(selector).expect("valid generated domain selector")
}

fn prototype_cubit_revision_id() -> Felt {
    // A13 pins this source revision until its production program/class identity is published.
    Felt::from_hex("0x262265ac5573c6cd62eb0c2b6365a49be4e7068c25ffabc321513c0eb68e251")
        .expect("valid prototype Cubit revision identifier")
}

fn calculate_player_mmr(
    policy: &MmrFormulaPolicy,
    player_mmr: u128,
    rank: u16,
    player_count: u16,
    game_median: u128,
    global_median: u128,
) -> Result<u128, MmrPlanError> {
    let spread = Fixed::unscaled(policy.spread_factor.into(), false)?;
    let difference = Fixed::unscaled(player_mmr.abs_diff(game_median), player_mmr < game_median)?;
    let expected = Fixed::one().div(difference.div(spread)?.exp()?.add(Fixed::one())?)?;
    let actual = if player_count <= 1 {
        Fixed::zero()
    } else {
        Fixed::unscaled((rank - 1).into(), false)?
            .div(Fixed::unscaled((player_count - 1).into(), false)?)?
    };
    let lobby_scale = Fixed::unscaled(player_count.into(), false)?
        .div(Fixed::unscaled(6, false)?)?
        .sqrt()?;
    let raw = Fixed::unscaled(policy.k_factor.into(), false)?
        .mul(lobby_scale)?
        .mul(expected.sub(actual)?)?;
    let maximum = Fixed::unscaled(policy.max_delta.into(), false)?;
    let delta = maximum.mul(raw.div(maximum)?.tanh()?)?;
    let tier_delta = apply_split_adjustment(delta, policy, game_median, global_median)?;
    let deviation = Fixed::unscaled(
        player_mmr.abs_diff(policy.distribution_mean.into()),
        player_mmr < policy.distribution_mean.into(),
    )?;
    let regression = Fixed::unscaled(policy.mean_regression_scaled.into(), false)?
        .div(Fixed::unscaled(10_000, false)?)?
        .mul(deviation)?;
    let adjusted = tier_delta.sub(regression)?;
    let magnitude = adjusted.mag / FIXED_ONE;
    Ok(if adjusted.negative {
        player_mmr.saturating_sub(magnitude)
    } else {
        player_mmr
            .checked_add(magnitude)
            .ok_or(MmrPlanError::Arithmetic)?
    })
}

fn apply_split_adjustment(
    delta: Fixed,
    policy: &MmrFormulaPolicy,
    game_median: u128,
    global_median: u128,
) -> Result<Fixed, MmrPlanError> {
    if game_median == global_median {
        return Ok(delta);
    }
    let spread = Fixed::unscaled(policy.spread_factor.into(), false)?;
    let mut bias = Fixed::unscaled(
        game_median.abs_diff(global_median),
        game_median < global_median,
    )?
    .div(spread)?;
    let half = Fixed::new(1_u128 << 63, bias.negative);
    if bias.mag > half.mag {
        bias = half;
    }
    let weight = Fixed::unscaled(policy.lobby_split_weight_scaled.into(), false)?
        .div(Fixed::unscaled(10_000, false)?)?;
    delta.mul(Fixed::one().add(weight.mul(bias)?)?)
}

#[derive(Debug, Clone, Copy)]
struct Fixed {
    mag: u128,
    negative: bool,
}

impl Fixed {
    fn new(mag: u128, negative: bool) -> Self {
        Self {
            mag,
            negative: negative && mag != 0,
        }
    }

    fn zero() -> Self {
        Self::new(0, false)
    }

    fn one() -> Self {
        Self::new(FIXED_ONE, false)
    }

    fn unscaled(value: u128, negative: bool) -> Result<Self, MmrPlanError> {
        value
            .checked_mul(FIXED_ONE)
            .map(|mag| Self::new(mag, negative))
            .ok_or(MmrPlanError::Arithmetic)
    }

    fn add(self, other: Self) -> Result<Self, MmrPlanError> {
        if self.negative == other.negative {
            self.mag
                .checked_add(other.mag)
                .map(|mag| Self::new(mag, self.negative))
                .ok_or(MmrPlanError::Arithmetic)
        } else if self.mag >= other.mag {
            Ok(Self::new(self.mag - other.mag, self.negative))
        } else {
            Ok(Self::new(other.mag - self.mag, other.negative))
        }
    }

    fn sub(self, other: Self) -> Result<Self, MmrPlanError> {
        self.add(Self::new(other.mag, !other.negative))
    }

    fn mul(self, other: Self) -> Result<Self, MmrPlanError> {
        let value =
            (WideU256::from(self.mag) * WideU256::from(other.mag)) / WideU256::from(FIXED_ONE);
        Ok(Self::new(
            wide_to_u128(value)?,
            self.negative ^ other.negative,
        ))
    }

    fn div(self, other: Self) -> Result<Self, MmrPlanError> {
        if other.mag == 0 {
            return Err(MmrPlanError::Arithmetic);
        }
        let value = (WideU256::from(self.mag) << 64) / WideU256::from(other.mag);
        Ok(Self::new(
            wide_to_u128(value)?,
            self.negative ^ other.negative,
        ))
    }

    fn sqrt(self) -> Result<Self, MmrPlanError> {
        if self.negative {
            return Err(MmrPlanError::Arithmetic);
        }
        self.mag
            .isqrt()
            .checked_mul(1_u128 << 32)
            .map(|mag| Self::new(mag, false))
            .ok_or(MmrPlanError::Arithmetic)
    }

    fn exp(self) -> Result<Self, MmrPlanError> {
        Self::new(26_613_026_195_688_644_984, false)
            .mul(self)?
            .exp2()
    }

    fn exp2(self) -> Result<Self, MmrPlanError> {
        if self.mag == 0 {
            return Ok(Self::one());
        }
        let integer = self.mag / FIXED_ONE;
        if integer > 63 {
            return Err(MmrPlanError::Arithmetic);
        }
        let fraction = self.mag % FIXED_ONE;
        let mut result = Self::unscaled(1_u128 << integer, false)?;
        if fraction != 0 {
            let fraction = Self::new(fraction, false);
            let r8 = Self::new(41_691_949_755_436, false).mul(fraction)?;
            let r7 = r8
                .add(Self::new(231_817_862_090_993, false))?
                .mul(fraction)?;
            let r6 = r7
                .add(Self::new(2_911_875_592_466_782, false))?
                .mul(fraction)?;
            let r5 = r6
                .add(Self::new(24_539_637_786_416_367, false))?
                .mul(fraction)?;
            let r4 = r5
                .add(Self::new(177_449_490_038_807_528, false))?
                .mul(fraction)?;
            let r3 = r4
                .add(Self::new(1_023_863_119_786_103_800, false))?
                .mul(fraction)?;
            let r2 = r3
                .add(Self::new(4_431_397_849_999_009_866, false))?
                .mul(fraction)?;
            let r1 = r2
                .add(Self::new(12_786_308_590_235_521_577, false))?
                .mul(fraction)?;
            result = result.mul(r1.add(Self::one())?)?;
        }
        if self.negative {
            Self::one().div(result)
        } else {
            Ok(result)
        }
    }

    fn tanh(self) -> Result<Self, MmrPlanError> {
        let exp = Self::unscaled(2, false)?.mul(self)?.exp()?;
        exp.sub(Self::one())?.div(exp.add(Self::one())?)
    }
}

fn wide_to_u128(value: WideU256) -> Result<u128, MmrPlanError> {
    let limbs = value.as_limbs();
    if limbs[2] != 0 || limbs[3] != 0 {
        return Err(MmrPlanError::Arithmetic);
    }
    Ok(u128::from(limbs[0]) | (u128::from(limbs[1]) << 64))
}
