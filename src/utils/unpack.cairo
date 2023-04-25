use array::ArrayTrait;
use traits::Into;
use traits::TryInto;
use eternum::constants::RESOURCE_IDS_PACKED_SIZE;
use eternum::constants::PRIME;
use traits::BitAnd;
use quaireaux_math::fast_power::fast_power;

fn unpack_resource_ids(resource_ids_packed: u256, resource_ids_count: usize) -> Array<u256> {
    let mut resource_ids = ArrayTrait::<u256>::new();
    let mask_size: u256 = (fast_power(2, RESOURCE_IDS_PACKED_SIZE.into(), PRIME) - 1).into();
    let mut i = 0_usize;
    loop {
        if i == resource_ids_count {
            break ();
        }
        let index = i * RESOURCE_IDS_PACKED_SIZE;
        let power: u256 = fast_power(2, index.into(), PRIME).into();
        let mask: u256 = mask_size * power;

        // 2. Apply mask using bitwise operation: mask AND data.
        let masked = BitAnd::bitand(mask, resource_ids_packed);

        // 3. Shift element right by dividing by the order of the mask.
        let result = masked / power;

        resource_ids.append(result);

        i = i + 1_usize;
    };

    return resource_ids;
}
