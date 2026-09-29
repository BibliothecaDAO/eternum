use core::debug::PrintTrait;
use eternum_cubit::f128::types::fixed::{Fixed, FixedPrint, FixedTrait};

#[derive(Copy, Drop, Serde, starknet::Store)]
struct Vec3 {
    x: Fixed,
    y: Fixed,
    z: Fixed,
}

trait Vec3Trait {
    // Constructors
    fn new(x: Fixed, y: Fixed, z: Fixed) -> Vec3;
    fn splat(v: Fixed) -> Vec3;
    // Math
    fn abs(self: Vec3) -> Vec3;
    fn cross(self: Vec3, rhs: Vec3) -> Vec3;
    fn dot(self: Vec3, rhs: Vec3) -> Fixed;
    fn floor(self: Vec3) -> Vec3;
    fn norm(self: Vec3) -> Fixed;
    // Scalar Math
    fn add(self: Vec3, scalar: Fixed) -> Vec3;
    fn sub(self: Vec3, scalar: Fixed) -> Vec3;
    fn mul(self: Vec3, scalar: Fixed) -> Vec3;
    fn div(self: Vec3, scalar: Fixed) -> Vec3;
    fn rem(self: Vec3, scalar: Fixed) -> Vec3;
}

// Implementations

impl Vec3Impl of Vec3Trait {
    // Creates a new vector.
    fn new(x: Fixed, y: Fixed, z: Fixed) -> Vec3 {
        return Vec3 { x: x, y: y, z: z };
    }

    // Creates a vector with all elements set to `v`.
    fn splat(v: Fixed) -> Vec3 {
        return Vec3 { x: v, y: v, z: v };
    }

    fn abs(self: Vec3) -> Vec3 {
        return abs(self);
    }

    fn cross(self: Vec3, rhs: Vec3) -> Vec3 {
        return cross(self, rhs);
    }

    // Computes the dot product of `self` and `rhs` .
    // #[inline(always)] is not allowed for functions with impl generic parameters.
    fn dot(self: Vec3, rhs: Vec3) -> Fixed {
        return dot(self, rhs);
    }

    fn floor(self: Vec3) -> Vec3 {
        return floor(self);
    }

    fn norm(self: Vec3) -> Fixed {
        return norm(self);
    }

    fn add(self: Vec3, scalar: Fixed) -> Vec3 {
        return Vec3 { x: self.x + scalar, y: self.y + scalar, z: self.z + scalar };
    }

    fn sub(self: Vec3, scalar: Fixed) -> Vec3 {
        return Vec3 { x: self.x - scalar, y: self.y - scalar, z: self.z - scalar };
    }

    fn mul(self: Vec3, scalar: Fixed) -> Vec3 {
        return Vec3 { x: self.x * scalar, y: self.y * scalar, z: self.z * scalar };
    }

    fn div(self: Vec3, scalar: Fixed) -> Vec3 {
        return Vec3 { x: self.x / scalar, y: self.y / scalar, z: self.z / scalar };
    }

    fn rem(self: Vec3, scalar: Fixed) -> Vec3 {
        return Vec3 { x: self.x % scalar, y: self.y % scalar, z: self.z % scalar };
    }
}

impl Vec3Print of PrintTrait<Vec3> {
    fn print(self: Vec3) {
        self.x.print();
        self.y.print();
        self.z.print();
    }
}

impl Vec3Add of Add<Vec3> {
    fn add(lhs: Vec3, rhs: Vec3) -> Vec3 {
        return add(lhs, rhs);
    }
}

impl Vec3Div of Div<Vec3> {
    fn div(lhs: Vec3, rhs: Vec3) -> Vec3 {
        return div(lhs, rhs);
    }
}

impl Vec3Mul of Mul<Vec3> {
    fn mul(lhs: Vec3, rhs: Vec3) -> Vec3 {
        return mul(lhs, rhs);
    }
}

impl Vec3Rem of Rem<Vec3> {
    fn rem(lhs: Vec3, rhs: Vec3) -> Vec3 {
        return rem(lhs, rhs);
    }
}

impl Vec3Sub of Sub<Vec3> {
    fn sub(lhs: Vec3, rhs: Vec3) -> Vec3 {
        return sub(lhs, rhs);
    }
}

// Functions

fn abs(a: Vec3) -> Vec3 {
    return Vec3 { x: a.x.abs(), y: a.y.abs(), z: a.z.abs() };
}

fn add(a: Vec3, b: Vec3) -> Vec3 {
    return Vec3 { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

fn cross(a: Vec3, b: Vec3) -> Vec3 {
    return Vec3 { x: (a.y * b.z) - (a.z * b.y), y: (a.z * b.x) - (a.x * b.z), z: (a.x * b.y) - (a.y * b.x) };
}

fn div(a: Vec3, b: Vec3) -> Vec3 {
    return Vec3 { x: a.x / b.x, y: a.y / b.y, z: a.z / b.z };
}

fn dot(a: Vec3, b: Vec3) -> Fixed {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

fn floor(a: Vec3) -> Vec3 {
    return Vec3 { x: a.x.floor(), y: a.y.floor(), z: a.z.floor() };
}

fn mul(a: Vec3, b: Vec3) -> Vec3 {
    return Vec3 { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

fn norm(a: Vec3) -> Fixed {
    return dot(a, a).sqrt();
}

fn rem(a: Vec3, b: Vec3) -> Vec3 {
    return Vec3 { x: a.x % b.x, y: a.y % b.y, z: a.z % b.z };
}

fn sub(a: Vec3, b: Vec3) -> Vec3 {
    return Vec3 { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
// Tests
// --------------------------------------------------------------------------------------------------------------


