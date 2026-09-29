#[starknet::component]
pub mod BitcoinState {
    const CONTRIBUTOR_INDEX_LIMIT: u64 = 0x100000000;
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::bitcoin::{ClaimKey, Contribution, ContributionKey, MineFunding, Phase, PhaseKey, PhaseStatus};
    use crate::events::RowSet;
    use crate::resources::ResourceKey;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn mine(self: @ComponentState<TContractState>, key: ResourceKey) -> MineFunding {
            let funding = self.data.bitcoin.mines.read((key.game_id, key.entity_id));
            assert!(funding.eligible_from != 0, "unknown Bitcoin mine");
            funding
        }
        fn register_mine(ref self: ComponentState<TContractState>, key: ResourceKey, next_phase: u64) {
            assert!(
                next_phase != 0 && self.data.bitcoin.mines.read((key.game_id, key.entity_id)).eligible_from == 0,
                "Bitcoin mine already registered",
            );
            self.write_mine(key, MineFunding { eligible_from: next_phase, next_phase, ..Default::default() });
        }
        fn capture_mine(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            eligible_from: u64,
            closed_before: u64,
            prize_per_phase: u128,
        ) {
            let mut funding = self.mine(key);
            assert!(eligible_from >= funding.eligible_from, "Bitcoin capture time decreased");
            // Completed claims advance next_phase atomically, including forfeited winner shares.
            // Only the unpaid closed prefix receives a new unsplit credit; a phase still open at capture is not yet
            // owed.
            if funding.next_phase < closed_before {
                let unpaid: u128 = (closed_before - funding.next_phase).into();
                funding.unsplit_carry += unpaid * prize_per_phase;
            }
            funding.eligible_from = eligible_from;
            funding.next_phase = core::cmp::max(funding.next_phase, eligible_from);
            self.write_mine(key, funding);
        }
        fn write_mine(ref self: ComponentState<TContractState>, key: ResourceKey, funding: MineFunding) {
            self.data.bitcoin.mines.write((key.game_id, key.entity_id), funding);
            let mut values = array![];
            funding.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'BitcoinMine',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn was_claimed(self: @ComponentState<TContractState>, key: ClaimKey) -> bool {
            self.data.bitcoin.claimed.read((key.game_id, key.phase, key.mine_id))
        }
        fn complete_claim(ref self: ComponentState<TContractState>, key: ClaimKey, mut funding: MineFunding) {
            assert!(!self.was_claimed(key), "Bitcoin prize already claimed");
            assert!(key.phase == funding.next_phase, "claim earlier Bitcoin phase first");
            funding.next_phase += 1;
            self.write_mine(ResourceKey { game_id: key.game_id, entity_id: key.mine_id }, funding);
            self.data.bitcoin.claimed.write((key.game_id, key.phase, key.mine_id), true);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'BitcoinClaim',
                        keys: array![key.game_id.into(), key.phase.into(), key.mine_id.into()].span(),
                        values: array![1].span(),
                    },
                );
        }
        fn winner(self: @ComponentState<TContractState>, key: ClaimKey) -> ContractAddress {
            let phase_key = PhaseKey { game_id: key.game_id, phase: key.phase };
            let phase = self.phase(phase_key);
            assert!(phase.state == PhaseStatus::Bound && phase.total_labor != 0, "Bitcoin phase has no bound draw");
            let hash: u256 = core::poseidon::poseidon_hash_span(
                array![
                    'BITCOIN_DRAW', 1, key.game_id.into(), key.phase.into(), key.mine_id.into(), phase.root.low.into(),
                    phase.root.high.into(),
                ]
                    .span(),
            )
                .into();
            let mut roll: u128 = (hash % phase.total_labor.into()).try_into().unwrap();
            // A fixed-height prefix tree keeps the original contributor-order lottery bounded.
            let mut index = 0_u64;
            let mut bit = CONTRIBUTOR_INDEX_LIMIT / 2;
            while bit != 0 {
                let next = index + bit;
                if next <= phase.contributors.into() {
                    let weight = self.data.bitcoin.labor_prefixes.read((key.game_id, key.phase, next));
                    if roll >= weight {
                        roll -= weight;
                        index = next;
                    }
                }
                bit /= 2;
            }
            self.contributor(phase_key, index.try_into().unwrap())
        }

        fn phase(self: @ComponentState<TContractState>, key: PhaseKey) -> Phase {
            self.data.bitcoin.phases.read((key.game_id, key.phase))
        }
        fn contribution(self: @ComponentState<TContractState>, key: ContributionKey) -> Contribution {
            self.data.bitcoin.contributions.read((key.game_id, key.phase, key.player))
        }
        fn contributor(self: @ComponentState<TContractState>, key: PhaseKey, index: u32) -> ContractAddress {
            assert!(index < self.phase(key).contributors, "unknown Bitcoin contributor");
            self.data.bitcoin.contributors.read((key.game_id, key.phase, index))
        }
        fn contribute(ref self: ComponentState<TContractState>, key: ContributionKey, structure_id: u32, amount: u128) {
            let phase_key = PhaseKey { game_id: key.game_id, phase: key.phase };
            let mut phase = self.phase(phase_key);
            assert!(phase.state == PhaseStatus::Open, "Bitcoin pool is closed");
            assert!(amount != 0, "zero Bitcoin contribution");
            let mut contribution = self.contribution(key);
            if contribution.labor == 0 {
                contribution.structure_id = structure_id;
                self.data.bitcoin.contributor_indices.write((key.game_id, key.phase, key.player), phase.contributors);
                self.data.bitcoin.contributors.write((key.game_id, key.phase, phase.contributors), key.player);
                phase.contributors += 1;
            }
            contribution.labor += amount;
            phase.total_labor += amount;
            self.data.bitcoin.contributions.write((key.game_id, key.phase, key.player), contribution);
            self.add_labor_prefixes(key, amount);
            let mut values = array![];
            contribution.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'BitcoinContribution',
                        keys: array![key.game_id.into(), key.phase.into(), key.player.into()].span(),
                        values: values.span(),
                    },
                );
            self.write_phase(phase_key, phase);
        }
        fn add_labor_prefixes(ref self: ComponentState<TContractState>, key: ContributionKey, amount: u128) {
            let mut index: u64 = self
                .data
                .bitcoin
                .contributor_indices
                .read((key.game_id, key.phase, key.player))
                .into();
            index += 1;
            // Update future prefixes too, so appending a contributor never rebuilds earlier sums.
            while index < CONTRIBUTOR_INDEX_LIMIT {
                let slot = (key.game_id, key.phase, index);
                self.data.bitcoin.labor_prefixes.write(slot, self.data.bitcoin.labor_prefixes.read(slot) + amount);
                index += index & (CONTRIBUTOR_INDEX_LIMIT - index);
            }
        }
        fn close(ref self: ComponentState<TContractState>, key: PhaseKey) {
            let mut phase = self.phase(key);
            if phase.state != PhaseStatus::Open {
                return;
            }
            phase.state = PhaseStatus::Closed;
            self.write_phase(key, phase);
        }
        fn bind(ref self: ComponentState<TContractState>, key: PhaseKey, root: u256) {
            let mut phase = self.phase(key);
            assert!(phase.state == PhaseStatus::Closed, "Bitcoin pool must close before binding");
            phase.root = root;
            phase.state = PhaseStatus::Bound;
            self.write_phase(key, phase);
        }
        fn write_phase(ref self: ComponentState<TContractState>, key: PhaseKey, phase: Phase) {
            self.data.bitcoin.phases.write((key.game_id, key.phase), phase);
            let mut values = array![];
            phase.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'BitcoinPhase',
                        keys: array![key.game_id.into(), key.phase.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
