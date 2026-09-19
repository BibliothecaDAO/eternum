use core::debug::PrintTrait;
use eternum_cubit::f128::types::fixed::{Fixed, FixedPrint, FixedTrait};

#[derive(Copy, Drop, Serde, starknet::Store)]
struct Vec4 {
    x: Fixed,
    y: Fixed,
    z: Fixed,
    w: Fixed,
}

trait Vec4Trait {
    // Constructors
    fn new(x: Fixed, y: Fixed, z: Fixed, w: Fixed) -> Vec4;
    fn splat(v: Fixed) -> Vec4;
    // Math
    fn abs(self: Vec4) -> Vec4;
    fn dot(self: Vec4, rhs: Vec4) -> Fixed;
    fn floor(self: Vec4) -> Vec4;
    fn norm(self: Vec4) -> Fixed;
    // Scalar Math
    fn add(self: Vec4, scalar: Fixed) -> Vec4;
    fn sub(self: Vec4, scalar: Fixed) -> Vec4;
    fn mul(self: Vec4, scalar: Fixed) -> Vec4;
    fn div(self: Vec4, scalar: Fixed) -> Vec4;
    fn rem(self: Vec4, scalar: Fixed) -> Vec4;
}

// Implementations

impl Vec4Impl of Vec4Trait {
    // Creates a new vector.
    #[inline(always)]
    fn new(x: Fixed, y: Fixed, z: Fixed, w: Fixed) -> Vec4 {
        return Vec4 { x: x, y: y, z: z, w: w };
    }

    // Creates a vector with all elements set to `v`.
    #[inline(always)]
    fn splat(v: Fixed) -> Vec4 {
        return Vec4 { x: v, y: v, z: v, w: v };
    }

    fn abs(self: Vec4) -> Vec4 {
        return abs(self);
    }

    // Computes the dot product of `self` and `rhs`
    fn dot(self: Vec4, rhs: Vec4) -> Fixed {
        return dot(self, rhs);
    }

    fn floor(self: Vec4) -> Vec4 {
        return floor(self);
    }

    fn norm(self: Vec4) -> Fixed {
        return norm(self);
    }

    fn add(self: Vec4, scalar: Fixed) -> Vec4 {
        return Vec4 { x: self.x + scalar, y: self.y + scalar, z: self.z + scalar, w: self.w + scalar };
    }

    fn sub(self: Vec4, scalar: Fixed) -> Vec4 {
        return Vec4 { x: self.x - scalar, y: self.y - scalar, z: self.z - scalar, w: self.w - scalar };
    }

    fn mul(self: Vec4, scalar: Fixed) -> Vec4 {
        return Vec4 { x: self.x * scalar, y: self.y * scalar, z: self.z * scalar, w: self.w * scalar };
    }

    fn div(self: Vec4, scalar: Fixed) -> Vec4 {
        return Vec4 { x: self.x / scalar, y: self.y / scalar, z: self.z / scalar, w: self.w / scalar };
    }

    fn rem(self: Vec4, scalar: Fixed) -> Vec4 {
        return Vec4 { x: self.x % scalar, y: self.y % scalar, z: self.z % scalar, w: self.w % scalar };
    }
}

impl Vec4Print of PrintTrait<Vec4> {
    fn print(self: Vec4) {
        self.x.print();
        self.y.print();
        self.z.print();
        self.w.print();
    }
}

impl Vec4Add of Add<Vec4> {
    fn add(lhs: Vec4, rhs: Vec4) -> Vec4 {
        return add(lhs, rhs);
    }
}

impl Vec4Div of Div<Vec4> {
    fn div(lhs: Vec4, rhs: Vec4) -> Vec4 {
        return div(lhs, rhs);
    }
}

impl Vec4Mul of Mul<Vec4> {
    fn mul(lhs: Vec4, rhs: Vec4) -> Vec4 {
        return mul(lhs, rhs);
    }
}

impl Vec4Rem of Rem<Vec4> {
    fn rem(lhs: Vec4, rhs: Vec4) -> Vec4 {
        return rem(lhs, rhs);
    }
}

impl Vec4Sub of Sub<Vec4> {
    fn sub(lhs: Vec4, rhs: Vec4) -> Vec4 {
        return sub(lhs, rhs);
    }
}

// Functions

fn abs(a: Vec4) -> Vec4 {
    return Vec4 { x: a.x.abs(), y: a.y.abs(), z: a.z.abs(), w: a.w.abs() };
}

fn add(a: Vec4, b: Vec4) -> Vec4 {
    return Vec4 { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z, w: a.w + b.w };
}

fn div(a: Vec4, b: Vec4) -> Vec4 {
    return Vec4 { x: a.x / b.x, y: a.y / b.y, z: a.z / b.z, w: a.w / b.w };
}

fn dot(a: Vec4, b: Vec4) -> Fixed {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z) + (a.w * b.w);
}

fn floor(a: Vec4) -> Vec4 {
    return Vec4 { x: a.x.floor(), y: a.y.floor(), z: a.z.floor(), w: a.w.floor() };
}

fn mul(a: Vec4, b: Vec4) -> Vec4 {
    return Vec4 { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z, w: a.w * b.w };
}

fn norm(a: Vec4) -> Fixed {
    return a.dot(a).sqrt();
}

fn rem(a: Vec4, b: Vec4) -> Vec4 {
    return Vec4 { x: a.x % b.x, y: a.y % b.y, z: a.z % b.z, w: a.w % b.w };
}

fn sub(a: Vec4, b: Vec4) -> Vec4 {
    return Vec4 { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z, w: a.w - b.w };
}
// Tests
// --------------------------------------------------------------------------------------------------------------


