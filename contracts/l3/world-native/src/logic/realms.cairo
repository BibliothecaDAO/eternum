#[starknet::component]
pub mod RealmState {
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use crate::events::RowSet;
    use crate::realms::{CANONICAL_REALM_COUNT, RealmTraits, decode_traits};

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
        fn initialize(ref self: ComponentState<TContractState>, first_realm: u32, packed_traits: Span<u32>) {
            assert!(!packed_traits.is_empty(), "empty realm catalogue batch");
            assert!(first_realm == self.data.realms.catalogue_count.read() + 1, "realm catalogue is append only");
            assert!(first_realm + packed_traits.len() - 1 <= CANONICAL_REALM_COUNT, "realm catalogue exceeds limit");
            let mut realm_id = first_realm;
            let mut digest = self.data.realms.catalogue_digest.read();
            for packed in packed_traits {
                let traits = decode_traits(*packed);
                self.data.realms.traits.write(realm_id, *packed);
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
            self.data.realms.catalogue_count.write(realm_id - 1);
            self.data.realms.catalogue_digest.write(digest);
        }
        fn traits(self: @ComponentState<TContractState>, realm_id: u32) -> RealmTraits {
            assert!(self.data.realms.catalogue_count.read() == CANONICAL_REALM_COUNT, "incomplete realm catalogue");
            assert!(realm_id >= 1 && realm_id <= CANONICAL_REALM_COUNT, "invalid canonical realm");
            decode_traits(self.data.realms.traits.read(realm_id))
        }
        fn available(self: @ComponentState<TContractState>, game_id: u32, index: u32, settled_count: u16) -> u32 {
            assert!(index < CANONICAL_REALM_COUNT - settled_count.into(), "realm pool index out of range");
            let realm_id = self.data.realms.slots.read((game_id, index));
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
            let reverse = self.data.realms.reverse_indices.read((game_id, realm_id));
            let index = if reverse == 0 {
                realm_id - 1
            } else {
                reverse - 1
            };
            assert!(index < remaining, "canonical realm already allocated");
            let last_id = self.available(game_id, remaining - 1, settled_count);
            if index != remaining - 1 {
                self.data.realms.slots.write((game_id, index), last_id);
                self.data.realms.reverse_indices.write((game_id, last_id), index + 1);
            }
            // A removed entry retains its former tail index, outside every later active prefix.
            self.data.realms.reverse_indices.write((game_id, realm_id), remaining);
        }
    }
}
