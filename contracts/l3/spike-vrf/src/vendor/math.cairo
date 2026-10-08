use core::felt252_div;

// Sage script to find Z
//
// # Arguments:
// # - F, a field object, e.g., F = GF(2^521 - 1)
// # - A and B, the coefficients of the curve y^2 = x^3 + A * x + B
// def find_z_sswu(F, A, B):
//     R.<xx> = F[]                       # Polynomial ring over F
//     g = xx^3 + F(A) * xx + F(B)        # y^2 = g(x) = x^3 + A * x + B
//     ctr = F.gen()
//     while True:
//         for Z_cand in (F(ctr), F(-ctr)):
//             # Criterion 1: Z is non-square in F.
//             if is_square(Z_cand):
//                 continue
//             # Criterion 2: Z != -1 in F.
//             if Z_cand == F(-1):
//                 continue
//             # Criterion 3: g(x) - Z is irreducible over F.
//             if not (g - Z_cand).is_irreducible():
//                 continue
//             # Criterion 4: g(B / (Z * A)) is square in F.
//             if is_square(g(B / (Z_cand * A))):
//                 return Z_cand
//         ctr += 1

// find_z_sswu(FiniteField(P), stark_curve::ALPHA, stark_curve::BETA)
pub const Z: felt252 = 19;
pub const A: felt252 = 1;
pub const B: felt252 = 0x6f21413efbe40de150e596d72f7a8c5609ad26c15c915c1f4cdfcb99cee9e89;

// Input: u and v, elements of F, where v != 0.
// Output: (b, y), where
//   b = True and y = sqrt(u / v) if (u / v) is square in F, and
//   b = False and y = sqrt(Z * (u / v)) otherwise.
pub fn sqrt_ratio(u: felt252, v: felt252, sqrt_ratio_hint: felt252) -> (bool, felt252) {
    let div = felt252_div(u, v.try_into().unwrap());
    let result = if sqrt_ratio_hint * sqrt_ratio_hint == div {
        Option::Some((true, sqrt_ratio_hint))
    } else if sqrt_ratio_hint * sqrt_ratio_hint == Z * div {
        Option::Some((false, sqrt_ratio_hint))
    } else {
        Option::None
    };
    result.unwrap()
}
