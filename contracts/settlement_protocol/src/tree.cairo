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
    validate_leaf_count(depth, leaves.len())?;

    let empty_nodes = build_empty_nodes(depth, empty_leaf_domain, node_domain);
    let mut level = array![];
    for leaf in leaves {
        level.append(*leaf);
    }
    if level.is_empty() {
        return Ok(*empty_nodes.at(depth.into()));
    }
    for tree_level in 0..depth {
        let mut parents = array![];
        for index in 0..(level.len() + 1) / 2 {
            let left = *level.at(index * 2);
            let right = if index * 2 + 1 < level.len() {
                *level.at(index * 2 + 1)
            } else {
                *empty_nodes.at(tree_level.into())
            };
            parents.append(hash_node(node_domain, left, right));
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
    validate_leaf_index(depth, leaf_index)?;
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

fn validate_leaf_count(depth: u8, count: usize) -> Result<(), TreeError> {
    validate_depth(depth)?;
    if depth < 32 && count > capacity_below_u32(depth) {
        return Err(TreeError::CapacityExceeded);
    }
    Ok(())
}

fn validate_leaf_index(depth: u8, index: usize) -> Result<(), TreeError> {
    validate_depth(depth)?;
    if depth < 32 && index >= capacity_below_u32(depth) {
        return Err(TreeError::IndexOutsideCapacity);
    }
    Ok(())
}

fn validate_depth(depth: u8) -> Result<(), TreeError> {
    if depth == 0 || depth > 32 {
        return Err(TreeError::InvalidDepth);
    }
    Ok(())
}

fn capacity_below_u32(depth: u8) -> usize {
    let mut capacity = 1;
    for _ in 0..depth {
        capacity *= 2;
    }
    capacity
}
