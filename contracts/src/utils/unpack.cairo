use array::ArrayTrait;
use traits::{Into, TryInto, BitAnd};
use option::OptionTrait;

use eternum::constants::RESOURCE_IDS_PACKED_SIZE;
use eternum::utils::math::pow;

fn unpack_resource_types(resource_types_packed: u128, resource_types_count: u8) -> Span<u8> {
    let mut resource_types = ArrayTrait::<u8>::new();
    let mut i = 0_usize;
    loop {
        if i == resource_types_count.into() {
            break ();
        }
        let mask_size: u128 = (pow(2, RESOURCE_IDS_PACKED_SIZE.into()) - 1).try_into().unwrap();
        let index = i * RESOURCE_IDS_PACKED_SIZE;
        let power: u128 = pow(2, index.into()).try_into().unwrap();
        let mask: u128 = mask_size * power;

        // 2. Apply mask using bitwise operation: mask AND data.
        let masked: u128 = BitAnd::bitand(mask, resource_types_packed);

        // 3. Shift element right by dividing by the order of the mask.
        let result: u128 = masked / power;

        resource_types.append(result.try_into().unwrap());

        i = i + 1;
    };

    resource_types.span()
}

// #[cfg(test)]
// mod tests {
//     use super::unpack_resource_types;
//     use traits::BitAnd;

//     #[test]
//     #[available_gas(30000000)]
//     fn test_unpack_resource_types() {
//         let packed_data = 515_u128;
//         let resource_types: Span<u8> = unpack_resource_types(packed_data, 2);
//         assert(*resource_types[0] == 3, 'resource_type should be 3');
//         assert(*resource_types[1] == 2, 'resource_type should be 2');
//     }
// }


