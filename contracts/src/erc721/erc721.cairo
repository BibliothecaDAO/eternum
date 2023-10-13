// TODO this is a temporary version of ERC721 in Dojo ECS
// TODO use openzeppelin implementation in final version

use starknet::{
    StorageAccess, StorageBaseAddress, SyscallResult, storage_read_syscall, storage_write_syscall,
    storage_address_from_base_and_offset
};
use traits::{Into, TryInto};
use option::OptionTrait;

use eternum::alias::ID;

#[derive(Drop, Serde)]
struct Position {
    x: u32,
    y: u32,
}

#[derive(Drop, Serde)]
struct RealmData {
    realm_id: u128, // OG Realm Id
    // packed resource ids of realm
    resource_types_packed: u128, // u256
    resource_types_count: u8,
    cities: u8,
    harbors: u8,
    rivers: u8,
    regions: u8,
    wonder: u8,
    order: u8,
}

impl Pos2DStorageAccess of StorageAccess<Position> {
    fn read(address_domain: u32, base: StorageBaseAddress) -> SyscallResult::<Position> {
        Result::Ok(
            Position {
                x: storage_read_syscall(
                    address_domain, storage_address_from_base_and_offset(base, 0_u8)
                )?
                    .try_into()
                    .unwrap(),
                y: storage_read_syscall(
                    address_domain, storage_address_from_base_and_offset(base, 1_u8)
                )?
                    .try_into()
                    .unwrap(),
            }
        )
    }

    fn write(
        address_domain: u32, base: StorageBaseAddress, value: Position
    ) -> SyscallResult::<()> {
        storage_write_syscall(
            address_domain, storage_address_from_base_and_offset(base, 0_u8), value.x.into()
        )?;
        storage_write_syscall(
            address_domain, storage_address_from_base_and_offset(base, 1_u8), value.y.into()
        )
    }
}


#[contract]
mod ERC721 {
    use array::ArrayTrait;
    use option::OptionTrait;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_contract_address;
    use traits::Into;
    use traits::TryInto;
    use zeroable::Zeroable;
    use starknet::contract_address::Felt252TryIntoContractAddress;

    use super::Position;
    use super::Pos2DStorageAccess;
    use super::RealmData;

    use dojo::storage::query::Query;
    use dojo::storage::query::QueryTrait;
    use dojo::storage::query::LiteralIntoQuery;
    use dojo::storage::query::TupleSize2IntoQuery;

    use dojo::interfaces::IWorldDispatcher;
    use dojo::interfaces::IWorldDispatcherTrait;

    use super::super::models::TokenApproval;

    use eternum::utils::math::pow;
    use eternum::constants::REALMS_DATA_PACKED_SIZE;
    use eternum::alias::ID;

    #[event]
    fn Transfer(from: ContractAddress, to: ContractAddress, token_id: u128) {}

    #[event]
    fn Approval(owner: ContractAddress, approved: ContractAddress, token_id: u128) {}

    struct Storage {
        _world: ContractAddress,
        _name: felt252,
        _symbol: felt252,
        _total_supply: u128,
        _realm_data: LegacyMap<ID, u128>,
        _realm_name: LegacyMap<ID, u256>,
        _realm_position: LegacyMap<ID, Position>,
    }

    //
    // Constructor
    //

    #[constructor]
    fn constructor(world_addr: ContractAddress, token_name: felt252, token_symbol: felt252) {
        _world::write(world_addr);
        _name::write(token_name);
        _symbol::write(token_symbol);
    }

    //
    // ERC721Metadata
    //

    #[view]
    fn name(realm_id: u128) -> felt252 {
        _name::read()
    }

    #[view]
    fn symbol() -> felt252 {
        _symbol::read()
    }

    #[view]
    fn owner_of(token_id: u128) -> ContractAddress {
        owner(token_id)
    }

    //
    // Realm specific metadata
    //

    #[view]
    fn realm_name(realm_id: u128) -> u256 {
        _realm_name::read(realm_id)
    }

    #[view]
    fn realm_position(realm_id: u128) -> Position {
        _realm_position::read(realm_id)
    }

    #[view]
    fn fetch_realm_data(realm_id: u128) -> RealmData {
        let realms_data_packed = _realm_data::read(realm_id);
        return unpack_realms_data(realm_id, realms_data_packed);
    }

    // TODO: should this be a system ?
    #[external]
    fn set_realm_data(
        realm_id: u128, realm_data: u128, realm_name: u256, realm_position: Position
    ) {
        //TODO: assert only owner
        _realm_data::write(realm_id, realm_data);
        _realm_name::write(realm_id, realm_name);
        _realm_position::write(realm_id, realm_position);
    }

    //
    // ERC721
    //

    #[external]
    fn transfer_from(from: ContractAddress, to: ContractAddress, token_id: u128) {
        transfer(from, to, token_id);
    }

    #[external]
    fn approve(approved: ContractAddress, token_id: u128) {
        let owner = owner(token_id);
        assert(owner != approved, 'approval to owner');

        let token: felt252 = get_contract_address().into();
        // TODO: get origin contract address when available
        // let caller = get_caller_address();
        // assert(caller == owner, 'not approved');

        let mut calldata = ArrayTrait::new();
        calldata.append(token);
        calldata.append(approved.into());
        calldata.append(token_id.into());
        world().execute('ERC721Approve'.into(), calldata.span());

        Approval(owner, approved, token_id);
    }

    //
    // NFT mint / burn
    //

    #[external]
    fn mint(to: ContractAddress) {
        assert(to.is_non_zero(), 'minting to zero address');
        // TODO: assert can mint

        let token = get_contract_address();
        let token_id = _total_supply::read() + 1;
        _total_supply::write(token_id);
        let mut calldata = ArrayTrait::<felt252>::new();
        calldata.append(token.into());
        calldata.append(to.into());
        calldata.append(token_id.into());
        world().execute('ERC721Mint'.into(), calldata.span());

        Transfer(Zeroable::zero(), to, token_id);
    }

    //
    // Internal
    //

    // NOTE: temporary, until we have inline commands outside of systems
    fn world() -> IWorldDispatcher {
        IWorldDispatcher { contract_address: _world::read() }
    }

    fn assert_valid_address(address: ContractAddress) {
        assert(address.is_non_zero(), 'invalid address');
    }

    #[inline(always)]
    fn owner(token_id: u128) -> ContractAddress {
        let contract_address: felt252 = get_contract_address().into();
        let query: Query = (contract_address, token_id).into();
        let owner = world().entity('Owner'.into(), query, 0_u8, 0_usize);
        (*owner[0]).try_into().unwrap()
    }

    // TODO: use approval when we have final ERC721
    // fn assert_approved_or_owner(owner: ContractAddress, operator: ContractAddress, token_id: u128) {
    //     let contract_address: felt252 = get_contract_address().into();
    //     let approved = world().entity(
    //         'TokenApproval'.into(), (contract_address, token_id.into(), 0_u8, 0_usize
    //     );
    //     assert(operator == owner | operator.into() == *approved[0], 'operation not allowed');
    // }

    fn transfer(from: ContractAddress, to: ContractAddress, token_id: u128) {
        let token = get_contract_address();
        let owner = owner(token_id);

        assert(owner == from, 'source not owner');
        assert(to.is_non_zero(), 'transferring to zero');

        // TODO: use approval when we have final ERC721
        // assert_approved_or_owner(owner, get_caller_address(), token_id);

        let mut calldata = ArrayTrait::new();
        calldata.append(token.into());
        calldata.append(from.into());
        calldata.append(to.into());
        calldata.append(token_id.into());
        world().execute('ERC721TransferFrom'.into(), calldata.span());

        Transfer(from, to, token_id);
    }


    fn unpack_realms_data(realm_id: u128, realms_data_packed: u128) -> RealmData {
        let mut realms_data = ArrayTrait::<u128>::new();
        let mut i = 0_usize;
        loop {
            // max number of resources on a realm = 7
            if i == 8 {
                break ();
            }
            let mut mask_size: u128 = 0_u128;
            let mut index: usize = 0_usize;

            // for resources need to have mask_size = 2^56 - 1
            if i == 5 {
                mask_size = (pow(2, (REALMS_DATA_PACKED_SIZE.into() * 7)) - 1).try_into().unwrap();
            } else {
                mask_size = (pow(2, REALMS_DATA_PACKED_SIZE.into()) - 1).try_into().unwrap();
            }

            // after resources need to skip 7 * 8 bits
            if i >= 6 {
                index = (i + 7) * REALMS_DATA_PACKED_SIZE;
            } else {
                index = i * REALMS_DATA_PACKED_SIZE
            }

            let power: u128 = pow(2, index.into()).try_into().unwrap();
            let mask: u128 = mask_size * power;

            // 2. Apply mask using bitwise operation: mask AND data.
            let masked: u128 = BitAnd::bitand(mask, realms_data_packed);

            // 3. Shift element right by dividing by the order of the mask.
            let result: u128 = masked / power;

            realms_data.append(result);

            i = i + 1_usize;
        };

        return RealmData {
            realm_id: realm_id,
            regions: (*realms_data[0]).try_into().unwrap(),
            cities: (*realms_data[1]).try_into().unwrap(),
            harbors: (*realms_data[2]).try_into().unwrap(),
            rivers: (*realms_data[3]).try_into().unwrap(),
            resource_types_count: (*realms_data[4]).try_into().unwrap(),
            resource_types_packed: *realms_data[5],
            wonder: (*realms_data[6]).try_into().unwrap(),
            order: (*realms_data[7]).try_into().unwrap(),
        };
    }
}
