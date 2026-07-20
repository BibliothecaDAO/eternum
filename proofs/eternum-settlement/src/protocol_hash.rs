use starknet_crypto::Felt;

use crate::codec::CanonicalEncode;
use crate::tree::{FixedDepthTree, TreeError};

pub(crate) fn domain(name: &str) -> Felt {
    let selector = crate::schema_vector::hash_domain_selector(name)
        .unwrap_or_else(|| panic!("unregistered settlement protocol domain: {name}"));
    Felt::from_hex(selector).expect("valid generated domain selector")
}

pub(crate) fn hash_encoded(domain_name: &str, value: &impl CanonicalEncode) -> Felt {
    let mut preimage = vec![domain(domain_name)];
    preimage.extend(value.encode());
    poseidon(&preimage)
}

pub(crate) fn hash_counted_list(domain_name: &str, leaves: impl IntoIterator<Item = Felt>) -> Felt {
    let leaves = leaves.into_iter().collect::<Vec<_>>();
    let mut preimage = Vec::with_capacity(leaves.len() + 2);
    preimage.extend([domain(domain_name), Felt::from(leaves.len())]);
    preimage.extend(leaves);
    poseidon(&preimage)
}

pub(crate) fn fixed_depth_root(
    depth: u8,
    empty_domain: &str,
    node_domain: &str,
    leaves: &[Felt],
) -> Result<Felt, TreeError> {
    FixedDepthTree::new(depth, domain(empty_domain), domain(node_domain))?.root(leaves)
}

pub(crate) fn poseidon(values: &[Felt]) -> Felt {
    crate::poseidon_hash_many(values)
}
