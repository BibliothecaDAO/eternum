use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::troops::Coord;

pub const CANONICAL_REALM_COUNT: u32 = 8000;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmTraits {
    pub wonder: u8,
    pub order: u8,
    pub resources: Span<u8>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmCatalogue {
    pub initialized: u32,
    pub digest: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettleSeason {
    pub name: felt252,
    pub selected_realm: Option<u32>,
}

#[starknet::interface]
pub trait ISeasonRealms<T> {
    fn initialize_realm_traits(ref self: T, first_realm: u32, packed_traits: Span<u32>);
    fn realm_catalogue(self: @T) -> RealmCatalogue;
    fn realm_traits(self: @T, realm_id: u32) -> RealmTraits;
    fn available_realm(self: @T, game_id: u32, index: u32) -> u32;
    fn settle_season(
        ref self: T, game_id: u32, actor: ContractAddress, command: SettleSeason, context: ExecutionContext,
    );
}

#[starknet::interface]
pub trait ISeasonPlacement<T> {
    fn claim_season_settlement(ref self: T, game_id: u32, settled_count: u16, seed: u256) -> Coord;
}


pub fn decode_traits(packed: u32) -> RealmTraits {
    let wonder = (packed / 0x4000000).try_into().unwrap();
    assert!(wonder >= 1 && wonder <= 51, "invalid realm wonder");
    let order = ((packed / 0x400000) % 16 + 1).try_into().unwrap();
    let mut mask = packed % 0x400000;
    let mut resources = array![];
    for resource in 1_u8..23 {
        if mask % 2 != 0 {
            resources.append(resource);
        }
        mask /= 2;
    }
    assert!(!resources.is_empty(), "realm has no production traits");
    RealmTraits { wonder, order, resources: resources.span() }
}

pub fn decode_entitlement(metadata: felt252) -> RealmTraits {
    let metadata: u256 = metadata.into();
    let length: u32 = (metadata % 256).try_into().unwrap();
    assert!(length <= 31, "invalid realm metadata length");
    let mut scale = 1_u256;
    for _ in 0..length {
        scale *= 256;
    }
    let mut value = (metadata / 65536) % scale;
    let mut attrs = array![];
    for _ in 0..length {
        if value == 0 {
            break;
        }
        attrs.append((value % 256).try_into().unwrap());
        value /= 256;
    }
    // The pinned encoding has four geographic attributes before resources, then Order and wonder.
    assert!(attrs.len() >= 7, "realm has no production traits");
    let wonder: u8 = *attrs.at(attrs.len() - 1);
    let order: u8 = *attrs.at(attrs.len() - 2);
    assert!(wonder >= 1 && wonder <= 51, "invalid realm wonder");
    assert!(order >= 1 && order <= 16, "invalid realm Order");
    RealmTraits { wonder, order, resources: attrs.span().slice(4, attrs.len() - 6) }
}

#[starknet::component]
pub mod RealmState {
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use crate::events::RowSet;
    use super::{CANONICAL_REALM_COUNT, RealmTraits, decode_traits};

    #[storage]
    pub struct Storage {
        #[flat]
        pub data: games_storage::realms::RealmStateStorage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn initialize(ref self: ComponentState<TContractState>, first_realm: u32, packed_traits: Span<u32>) {
            assert!(!packed_traits.is_empty(), "empty realm catalogue batch");
            assert!(first_realm == self.data.catalogue_count.read() + 1, "realm catalogue is append only");
            assert!(first_realm + packed_traits.len() - 1 <= CANONICAL_REALM_COUNT, "realm catalogue exceeds limit");
            let mut realm_id = first_realm;
            let mut digest = self.data.catalogue_digest.read();
            for packed in packed_traits {
                let traits = decode_traits(*packed);
                self.data.traits.write(realm_id, *packed);
                digest = core::poseidon::poseidon_hash_span(array![digest, realm_id.into(), (*packed).into()].span());
                let mut values = array![];
                traits.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'RealmTraits',
                            keys: array![realm_id.into()].span(),
                            values: values.span(),
                        },
                    );
                realm_id += 1;
            }
            self.data.catalogue_count.write(realm_id - 1);
            self.data.catalogue_digest.write(digest);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'RealmCatalogue',
                        keys: array![starknet::get_contract_address().into()].span(),
                        values: array![(realm_id - 1).into(), digest].span(),
                    },
                );
        }
        fn traits(self: @ComponentState<TContractState>, realm_id: u32) -> RealmTraits {
            assert!(self.data.catalogue_count.read() == CANONICAL_REALM_COUNT, "incomplete realm catalogue");
            assert!(realm_id >= 1 && realm_id <= CANONICAL_REALM_COUNT, "invalid canonical realm");
            decode_traits(self.data.traits.read(realm_id))
        }
        fn available(self: @ComponentState<TContractState>, game_id: u32, index: u32, settled_count: u16) -> u32 {
            assert!(index < CANONICAL_REALM_COUNT - settled_count.into(), "realm pool index out of range");
            let realm_id = self.data.slots.read((game_id, index));
            if realm_id == 0 {
                index + 1
            } else {
                realm_id
            }
        }
        fn reserve(ref self: ComponentState<TContractState>, game_id: u32, realm_id: u32, settled_count: u16) {
            assert!(realm_id >= 1 && realm_id <= CANONICAL_REALM_COUNT, "invalid canonical realm");
            let remaining = CANONICAL_REALM_COUNT - settled_count.into();
            assert!(remaining > 0, "all canonical realms allocated");
            let reverse = self.data.reverse_indices.read((game_id, realm_id));
            let index = if reverse == 0 {
                realm_id - 1
            } else {
                reverse - 1
            };
            assert!(index < remaining, "canonical realm already allocated");
            let last_id = self.available(game_id, remaining - 1, settled_count);
            if index != remaining - 1 {
                self.data.slots.write((game_id, index), last_id);
                self.data.reverse_indices.write((game_id, last_id), index + 1);
            }
            // A removed entry retains its former tail index, outside every later active prefix.
            self.data.reverse_indices.write((game_id, realm_id), remaining);
        }
    }
}
