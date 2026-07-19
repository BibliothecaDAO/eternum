use std::collections::{BTreeMap, BTreeSet};

use starknet_crypto::Felt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TreeError {
    InvalidDepth,
    CapacityExceeded,
    IndexOutsideCapacity,
    WrongProofLength,
}

pub struct FixedDepthTree {
    depth: u8,
    empty_nodes: Vec<Felt>,
    node_domain: Felt,
}

impl FixedDepthTree {
    pub fn new(depth: u8, empty_leaf_domain: Felt, node_domain: Felt) -> Result<Self, TreeError> {
        if depth == 0 || depth > 252 {
            return Err(TreeError::InvalidDepth);
        }
        let mut empty_nodes = vec![crate::poseidon_hash_many(&[empty_leaf_domain])];
        for level in 0..depth as usize {
            empty_nodes.push(crate::poseidon_hash_many(&[
                node_domain,
                empty_nodes[level],
                empty_nodes[level],
            ]));
        }
        Ok(Self {
            depth,
            empty_nodes,
            node_domain,
        })
    }

    pub fn root(&self, leaves: &[Felt]) -> Result<Felt, TreeError> {
        self.validate_leaf_count(leaves.len())?;
        Ok(self
            .build_levels(leaves)
            .last()
            .unwrap()
            .get(&0)
            .copied()
            .unwrap_or(self.empty_nodes[self.depth as usize]))
    }

    pub fn proof(&self, leaves: &[Felt], leaf_index: usize) -> Result<Vec<Felt>, TreeError> {
        self.validate_leaf_count(leaves.len())?;
        self.validate_index(leaf_index)?;
        let levels = self.build_levels(leaves);
        let mut index = leaf_index;
        Ok(levels[..self.depth as usize]
            .iter()
            .enumerate()
            .map(|(depth, level)| {
                let sibling = level
                    .get(&(index ^ 1))
                    .copied()
                    .unwrap_or(self.empty_nodes[depth]);
                index /= 2;
                sibling
            })
            .collect())
    }

    pub fn verify(
        &self,
        leaf_hash: Felt,
        leaf_index: usize,
        siblings: &[Felt],
        root: Felt,
    ) -> Result<bool, TreeError> {
        self.validate_index(leaf_index)?;
        if siblings.len() != self.depth as usize {
            return Err(TreeError::WrongProofLength);
        }
        let mut current = leaf_hash;
        let mut index = leaf_index;
        for sibling in siblings {
            current = if index & 1 == 0 {
                crate::poseidon_hash_many(&[self.node_domain, current, *sibling])
            } else {
                crate::poseidon_hash_many(&[self.node_domain, *sibling, current])
            };
            index /= 2;
        }
        Ok(current == root)
    }

    fn build_levels(&self, leaves: &[Felt]) -> Vec<BTreeMap<usize, Felt>> {
        let first_level: BTreeMap<usize, Felt> = leaves.iter().copied().enumerate().collect();
        let mut levels = vec![first_level];
        for depth in 0..self.depth as usize {
            let current = &levels[depth];
            let parents = current
                .keys()
                .map(|index| index / 2)
                .collect::<BTreeSet<_>>();
            let next = parents
                .into_iter()
                .map(|parent| {
                    let left = current
                        .get(&(parent * 2))
                        .copied()
                        .unwrap_or(self.empty_nodes[depth]);
                    let right = current
                        .get(&(parent * 2 + 1))
                        .copied()
                        .unwrap_or(self.empty_nodes[depth]);
                    (
                        parent,
                        crate::poseidon_hash_many(&[self.node_domain, left, right]),
                    )
                })
                .collect();
            levels.push(next);
        }
        levels
    }

    fn validate_leaf_count(&self, count: usize) -> Result<(), TreeError> {
        if self.depth < usize::BITS as u8 && count > (1usize << self.depth) {
            return Err(TreeError::CapacityExceeded);
        }
        Ok(())
    }

    fn validate_index(&self, index: usize) -> Result<(), TreeError> {
        if self.depth < usize::BITS as u8 && index >= (1usize << self.depth) {
            return Err(TreeError::IndexOutsideCapacity);
        }
        Ok(())
    }
}
