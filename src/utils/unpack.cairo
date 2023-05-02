use array::ArrayTrait;
use traits::Into;
use traits::TryInto;
use eternum::constants::RESOURCE_IDS_PACKED_SIZE;
use eternum::constants::REALMS_DATA_PACKED_SIZE;
use eternum::constants::PRIME;
use traits::BitAnd;
use eternum::utils::math::pow;
use debug::PrintTrait;

fn unpack_resource_ids(resource_ids_packed: u256, resource_ids_count: usize) -> Array<u256> {
    let mut resource_ids = ArrayTrait::<u256>::new();
    let mut i = 0_usize;
    loop {
        if i == resource_ids_count {
            break ();
        }
        let mask_size: u256 = (pow(2, RESOURCE_IDS_PACKED_SIZE.into()) - 1).into();
        let index = i * RESOURCE_IDS_PACKED_SIZE;
        let power: u256 = pow(2, index.into()).into();
        let mask: u256 = mask_size * power;

        // 2. Apply mask using bitwise operation: mask AND data.
        let masked = BitAnd::bitand(mask, resource_ids_packed);

        // 3. Shift element right by dividing by the order of the mask.
        let result = masked / power;

        resource_ids.append(result);

        i = i + 1_usize;
    };

    resource_ids
}

// TODO: could not create general unpack function for both because of
// withdraw_gas issue when dojo-test
fn unpack_realms_data(realms_data_packed: u256) -> Array<u256> {
    let mut realms_data = ArrayTrait::<u256>::new();
    let mut i = 0_usize;
    loop {
        // max number of resources on a realm = 7
        if i == 8 {
            break ();
        }
        let mut mask_size: u256 = 0.into();
        let mut index: usize = 0_usize;

        // for resources need to have mask_size = 2^56 - 1
        if i == 5 {
            mask_size = (pow(2, (REALMS_DATA_PACKED_SIZE.into() * 7)) - 1).into();
        } else {
            mask_size = (pow(2, REALMS_DATA_PACKED_SIZE.into()) - 1).into();
        }

        // after resources need to skip 7 * 8 bits
        if i >= 6 {
            index = (i + 7) * REALMS_DATA_PACKED_SIZE;
        } else {
            index = i * REALMS_DATA_PACKED_SIZE
        }

        let power: u256 = pow(2, index.into()).into();
        let mask: u256 = mask_size * power;

        // 2. Apply mask using bitwise operation: mask AND data.
        let masked = BitAnd::bitand(mask, realms_data_packed);

        // 3. Shift element right by dividing by the order of the mask.
        let result = masked / power;

        realms_data.append(result);

        i = i + 1_usize;
    };

    realms_data
}
