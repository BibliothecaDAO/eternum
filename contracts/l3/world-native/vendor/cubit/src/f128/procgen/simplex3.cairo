use eternum_cubit::f128::math::comp::{max, min};
use eternum_cubit::f128::types::fixed::{Fixed, FixedTrait, ONE_u128};
use eternum_cubit::f128::types::vec3::{Vec3, Vec3Trait};
use eternum_cubit::f128::types::vec4::{Vec4, Vec4Trait};

fn permute(x: Vec4) -> Vec4 {
    let v34 = Vec4Trait::splat(FixedTrait::new(627189298506124754944, false));
    let v1 = Vec4Trait::splat(FixedTrait::ONE());
    let v289 = Vec4Trait::splat(FixedTrait::new(5331109037302060417024, false));
    return (((x * v34) + v1) * x) % v289;
}

fn taylor_inv_sqrt(r: Vec4) -> Vec4 {
    let v1 = Vec4Trait::splat(FixedTrait::new(33072114398950993631, false)); // 1.79284291400159
    let v2 = Vec4Trait::splat(FixedTrait::new(15748625904262413056, false)); // 0.85373472095314
    return v1 - v2 * r;
}

// For x, 0.0 is returned if x < edge, and 1.0 is returned otherwise
fn step(edge: Fixed, x: Fixed) -> Fixed {
    if x < edge {
        return FixedTrait::ZERO();
    } else {
        return FixedTrait::ONE();
    }
}

fn noise(v: Vec3) -> Fixed {
    let zero = FixedTrait::ZERO();
    let half = FixedTrait::new(9223372036854775808, false); // 0.5
    let one = FixedTrait::ONE();

    let Cx = FixedTrait::new(3074457345618258602, false); // 1 / 6
    let Cy = FixedTrait::new(6148914691236517205, false); // 1 / 3

    // First corner
    let mut i = (v + Vec3Trait::splat(v.dot(Vec3Trait::splat(Cy)))).floor();
    let x0 = v - i + Vec3Trait::splat(i.dot(Vec3Trait::splat(Cx)));

    // Other corners
    let g = Vec3Trait::new(step(x0.y, x0.x), step(x0.z, x0.y), step(x0.x, x0.z));
    let l = Vec3Trait::splat(one) - g;
    let i1 = Vec3Trait::new(min(g.x, l.z), min(g.y, l.x), min(g.z, l.y));
    let i2 = Vec3Trait::new(max(g.x, l.z), max(g.y, l.x), max(g.z, l.y));

    // x0 = x0 - 0.0 + 0.0 * C.xxx;
    // x1 = x0 - i1  + 1.0 * C.xxx;
    // x2 = x0 - i2  + 2.0 * C.xxx;
    // x3 = x0 - 1.0 + 3.0 * C.xxx;
    let x1 = Vec3Trait::new(x0.x - i1.x + Cx, x0.y - i1.y + Cx, x0.z - i1.z + Cx);
    let x2 = Vec3Trait::new(x0.x - i2.x + Cy, x0.y - i2.y + Cy, x0.z - i2.z + Cy);
    let x3 = Vec3Trait::new(x0.x - half, x0.y - half, x0.z - half);

    // Permutations
    i = i.rem(FixedTrait::new(5331109037302060417024, false)); // 289
    let _p1 = permute(Vec4Trait::new(i.z + zero, i.z + i1.z, i.z + i2.z, i.z + one));
    let _p2 = permute(Vec4Trait::new(_p1.x + i.y + zero, _p1.y + i.y + i1.y, _p1.z + i.y + i2.y, _p1.w + i.y + one));
    let p = permute(Vec4Trait::new(_p2.x + i.x + zero, _p2.y + i.x + i1.x, _p2.z + i.x + i2.x, _p2.w + i.x + one));

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    let ns_x = FixedTrait::new(5270498306774157605, false); // 2 / 7
    let ns_y = FixedTrait::new(17129119497016012214, true); // -13 / 14
    let ns_z = FixedTrait::new(2635249153387078803, false); // 1 / 7

    let j = p.rem(FixedTrait::new(903890459611768029184, false)); // 49
    let x_ = (j.mul(ns_z)).floor();
    let y_ = (j - x_.mul(FixedTrait::new(129127208515966861312, false))).floor(); // 7

    let x = x_.mul(ns_x).add(ns_y);
    let y = y_.mul(ns_x).add(ns_y);
    let h = Vec4Trait::splat(one) - x.abs() - y.abs();

    // Revoke AP tracking until handled by compiler
    core::internal::revoke_ap_tracking();

    let b0 = Vec4Trait::new(x.x, x.y, y.x, y.y);
    let b1 = Vec4Trait::new(x.z, x.w, y.z, y.w);

    // vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
    // vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
    let s0 = b0.floor().mul(FixedTrait::new(36893488147419103232, false)).add(one);
    let s1 = b1.floor().mul(FixedTrait::new(36893488147419103232, false)).add(one);
    let sh = Vec4Trait::new(-step(h.x, zero), -step(h.y, zero), -step(h.z, zero), -step(h.w, zero));

    let a0 = Vec4Trait::new(b0.x + s0.x * sh.x, b0.z + s0.z * sh.x, b0.y + s0.y * sh.y, b0.w + s0.w * sh.y);
    let a1 = Vec4Trait::new(b1.x + s1.x * sh.z, b1.z + s1.z * sh.z, b1.y + s1.y * sh.w, b1.w + s1.w * sh.w);

    let mut p0 = Vec3Trait::new(a0.x, a0.y, h.x);
    let mut p1 = Vec3Trait::new(a0.z, a0.w, h.y);
    let mut p2 = Vec3Trait::new(a1.x, a1.y, h.z);
    let mut p3 = Vec3Trait::new(a1.z, a1.w, h.w);

    // Normalise gradients
    let norm = taylor_inv_sqrt(Vec4Trait::new(p0.dot(p0), p1.dot(p1), p2.dot(p2), p3.dot(p3)));
    let p0 = Vec3Trait::new(p0.x * norm.x, p0.y * norm.x, p0.z * norm.x);
    let p1 = Vec3Trait::new(p1.x * norm.y, p1.y * norm.y, p1.z * norm.y);
    let p2 = Vec3Trait::new(p2.x * norm.z, p2.y * norm.z, p2.z * norm.z);
    let p3 = Vec3Trait::new(p3.x * norm.w, p3.y * norm.w, p3.z * norm.w);

    // Mix final noise value
    let mut m = Vec4Trait::new(
        max(half - x0.dot(x0), zero),
        max(half - x1.dot(x1), zero),
        max(half - x2.dot(x2), zero),
        max(half - x3.dot(x3), zero),
    );

    m = (m * m) * (m * m);

    return FixedTrait::new_unscaled(105, false) * m.dot(Vec4Trait::new(p0.dot(x0), p1.dot(x1), p2.dot(x2), p3.dot(x3)));
}

fn noise_octaves(v: Vec3, mut octaves: u128, persistence: Fixed) -> Fixed {
    let mut s = FixedTrait::ONE();
    let mut t = FixedTrait::ZERO();
    let mut n = FixedTrait::ZERO();

    loop {
        if octaves == 0 {
            break;
        }
        octaves -= 1;
        n += noise(v / Vec3Trait::splat(s)) * s;
        t += s;
        s *= persistence;
    }

    return n / t;
}
// TODO: get noise at percentile

// Tests
// --------------------------------------------------------------------------------------------------------------


