//! The builds the map's units are drawn as, and what a unit leaves on the air and the ground. Where each unit
//! stands and what it does comes from the page, an instance a unit; its motion is `unit.wgsl`'s.

use glam::Vec3;

use crate::shapes::{Paint, Shape};

/// The animals of the map, by the names their models are packed under.
pub const ANIMALS: [&str; 7] = [
    "arctic-fox",
    "bengal-tiger",
    "jackrabbit",
    "moose",
    "mountain-goat",
    "plains-zebra",
    "red-deer",
];

/// Which model a unit is drawn as: one of the game's troops, or an animal by its place in `ANIMALS`.
#[derive(Clone, Copy, PartialEq)]
pub enum Role {
    Knight,
    Crossbowman,
    Paladin,
    Animal(usize),
}

impl Role {
    pub fn every() -> impl Iterator<Item = Role> {
        [Role::Knight, Role::Crossbowman, Role::Paladin]
            .into_iter()
            .chain((0..ANIMALS.len()).map(Role::Animal))
    }

    pub fn named(name: &str) -> Result<Role, String> {
        match name {
            "knight" => Ok(Role::Knight),
            "crossbowman" => Ok(Role::Crossbowman),
            "paladin" => Ok(Role::Paladin),
            other => ANIMALS
                .iter()
                .position(|animal| *animal == other)
                .map(Role::Animal)
                .ok_or_else(|| format!("No unit build is called {other}")),
        }
    }

    /// Whether it is one side's: an army's unit stands on a plate of its side's colour, an animal on none.
    pub fn is_troop(self) -> bool {
        !matches!(self, Role::Animal(_))
    }
}

fn v(x: f32, y: f32, z: f32) -> Vec3 {
    Vec3::new(x, y, z)
}

/// What a unit leaves on the air and the ground, placed by `unit.wgsl`: its hex plate and three
/// puffs of dust.
pub fn effects() -> Shape {
    let mut shape = Shape::default();
    let quad = |shape: &mut Shape, corners: [Vec3; 4], paint: Paint| {
        let [a, b, c, d] = corners.map(|corner| shape.point(corner, paint));
        shape.triangle([a, b, c]);
        shape.triangle([a, c, d]);
    };
    let square = |depth: f32, flat: bool| {
        [(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)].map(|(x, y)| {
            if flat {
                v(x, 0.0, y)
            } else {
                v(x, y, depth)
            }
        })
    };
    quad(
        &mut shape,
        square(0.0, true),
        Paint::of([0.0; 3]).bone(28.0),
    );
    for puff in 0..3 {
        quad(
            &mut shape,
            square(puff as f32, false),
            Paint::of([1.0; 3]).bone(30.0),
        );
    }
    shape
}
