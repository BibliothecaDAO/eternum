use core::poseidon::poseidon_hash_span;

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum TreeError {
    InvalidDepth,
    CapacityExceeded,
    IndexOutsideCapacity,
    WrongProofLength,
}

pub fn fixed_depth_root(
    leaves: Span<felt252>, depth: u8, empty_leaf_domain: felt252, node_domain: felt252,
) -> Result<felt252, TreeError> {
    let capacity = tree_capacity(depth)?;
    if leaves.len() > capacity {
        return Err(TreeError::CapacityExceeded);
    }

    let empty_nodes = build_empty_nodes(depth, empty_leaf_domain, node_domain);
    let mut level = array![];
    for index in 0..capacity {
        level.append(if index < leaves.len() {
            *leaves.at(index)
        } else {
            *empty_nodes.at(0)
        });
    }
    for _ in 0..depth {
        let mut parents = array![];
        for index in 0..level.len() / 2 {
            parents.append(hash_node(node_domain, *level.at(index * 2), *level.at(index * 2 + 1)));
        }
        level = parents;
    }
    Ok(*level.at(0))
}

pub fn verify_fixed_depth_proof(
    leaf_hash: felt252,
    leaf_index: usize,
    siblings: Span<felt252>,
    expected_root: felt252,
    depth: u8,
    node_domain: felt252,
) -> Result<bool, TreeError> {
    let capacity = tree_capacity(depth)?;
    if leaf_index >= capacity {
        return Err(TreeError::IndexOutsideCapacity);
    }
    if siblings.len() != depth.into() {
        return Err(TreeError::WrongProofLength);
    }

    let mut current = leaf_hash;
    let mut index = leaf_index;
    for sibling in siblings {
        current =
            if index & 1 == 0 {
                hash_node(node_domain, current, *sibling)
            } else {
                hash_node(node_domain, *sibling, current)
            };
        index /= 2;
    }
    Ok(current == expected_root)
}

fn build_empty_nodes(depth: u8, empty_leaf_domain: felt252, node_domain: felt252) -> Array<felt252> {
    let mut nodes = array![poseidon_hash_span(array![empty_leaf_domain].span())];
    for index in 0..depth {
        let current = *nodes.at(index.into());
        nodes.append(hash_node(node_domain, current, current));
    }
    nodes
}

fn hash_node(node_domain: felt252, left: felt252, right: felt252) -> felt252 {
    poseidon_hash_span(array![node_domain, left, right].span())
}

fn tree_capacity(depth: u8) -> Result<usize, TreeError> {
    if depth == 0 || depth > 16 {
        return Err(TreeError::InvalidDepth);
    }
    let mut capacity = 1;
    for _ in 0..depth {
        capacity *= 2;
    }
    Ok(capacity)
}
