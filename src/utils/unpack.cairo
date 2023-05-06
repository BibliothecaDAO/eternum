use array::ArrayTrait;
use traits::Into;
use traits::TryInto;
use option::OptionTrait;
use eternum::constants::RESOURCE_IDS_PACKED_SIZE;
use eternum::constants::PRIME;
use traits::BitAnd;
use eternum::utils::math::pow;
use debug::PrintTrait;

fn unpack_resource_ids(resource_ids_packed: u128, resource_ids_count: u8) -> Array<u8> {
    let mut resource_ids = ArrayTrait::<u8>::new();
    let mut i = 0_usize;
    loop {
        if i == resource_ids_count.into() {
            break ();
        }
        let mask_size: u128 = (pow(2, RESOURCE_IDS_PACKED_SIZE.into()) - 1).try_into().unwrap();
        let index = i * RESOURCE_IDS_PACKED_SIZE;
        let power: u128 = pow(2, index.into()).try_into().unwrap();
        let mask: u128 = mask_size * power;

        // 2. Apply mask using bitwise operation: mask AND data.
        let masked: u128 = BitAnd::bitand(mask, resource_ids_packed);

        // 3. Shift element right by dividing by the order of the mask.
        let result: u128 = masked / power;

        resource_ids.append(result.try_into().unwrap());

        i = i + 1;
    };

    resource_ids
}

