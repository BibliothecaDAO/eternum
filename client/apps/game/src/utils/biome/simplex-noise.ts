import { Fixed, FixedTrait } from "./fixed-point";
import { Vec3 } from "./vec3";
import { Vec4 } from "./vec4";



function permute(x: Vec4): Vec4 {
    let v34 = Vec4.splat(new Fixed(627189298506124754944n));
    let v1 = Vec4.splat(FixedTrait.ONE);
    let v289 = Vec4.splat(new Fixed(5331109037302060417024n));
    return x.mul(v34).add(v1).mul(x).mod(v289);
}

function taylor_inv_sqrt(r: Vec4): Vec4 {
    let v1: Vec4 = Vec4.splat(new Fixed(33072114398950993631n)); // 1.79284291400159
    let v2: Vec4 = Vec4.splat(new Fixed(15748625904262413056n)); // 0.85373472095314
    return v1.minus(v2.mul(r));
}



function step(edge: Fixed, x: Fixed): Fixed {
    if (x.value < edge.value) {
        return FixedTrait.ZERO;
    } else {
        return FixedTrait.ONE;
    }
}


function min(a: Fixed, b: Fixed): Fixed {
    return a.value < b.value ? a : b;
}

function max(a: Fixed, b: Fixed): Fixed {
    return a.value > b.value ? a : b;
}

export function noise(v: Vec3): Fixed {
    let zero = new Fixed(0n);
    let half = new Fixed(9223372036854775808n); // 0.5
    let one = FixedTrait.ONE;

    let Cx = new Fixed(3074457345618258602n); // 1 / 6
    let Cy = new Fixed(6148914691236517205n); // 1 / 3

    // First corner
    let i = v.add(Vec3.splat(v.dot(Vec3.splat(Cy)))).floor();
    let x0 = v.minus(i).add(Vec3.splat(i.dot(Vec3.splat(Cx))));


    // Other corners
    let g = Vec3.new(step(x0.y, x0.x), step(x0.z, x0.y), step(x0.x, x0.z));
    let l = Vec3.splat(one).minus(g);
    let i1 = Vec3.new(min(g.x, l.z), min(g.y, l.x), min(g.z, l.y));
    let i2 = Vec3.new(max(g.x, l.z), max(g.y, l.x), max(g.z, l.y));
    
    let x1 = Vec3.new(x0.x.sub(i1.x).add(Cx), x0.y.sub(i1.y).add(Cx), x0.z.sub(i1.z).add(Cx));
    let x2 = Vec3.new(x0.x.sub(i2.x).add(Cy), x0.y.sub(i2.y).add(Cy), x0.z.sub(i2.z).add(Cy));
    let x3 = Vec3.new(x0.x.sub(half), x0.y.sub(half), x0.z.sub(half));

    // Permutations
    i = i.remScaler(new Fixed(5331109037302060417024n)); // 289
    let _p1 = permute(Vec4.new(i.z.add(zero), i.z.add(i1.z), i.z.add(i2.z), i.z.add(one)));
    let _p2 = permute(
        Vec4.new(
            _p1.x.add(i.y).add(zero), _p1.y.add(i.y).add(i1.y), _p1.z.add(i.y).add(i2.y), _p1.w.add(i.y).add(one)
        )
    );
    let p = permute(
        Vec4.new(
            _p2.x.add(i.x).add(zero), _p2.y.add(i.x).add(i1.x), _p2.z.add(i.x).add(i2.x), _p2.w.add(i.x).add(one)
        )
    );


    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    let ns_x = new Fixed(5270498306774157605n); // 2 / 7
    let ns_y = new Fixed(-17129119497016012214n); // -13 / 14
    let ns_z = new Fixed(2635249153387078803n); // 1 / 7

    let j = p.remScaler(new Fixed(903890459611768029184n)); // 49
    let x_ = (j.mulScalar(ns_z)).floor();
    let y_ = (j.minus(x_.mulScalar(new Fixed(129127208515966861312n)))).floor(); // 7

    let x = x_.mulScalar(ns_x).addScalar(ns_y);
    let y = y_.mulScalar(ns_x).addScalar(ns_y);
    let h = Vec4.splat(one).minus(x.abs()).minus(y.abs());  

    let b0 = Vec4.new(x.x, x.y, y.x, y.y);
    let b1 = Vec4.new(x.z, x.w, y.z, y.w);

    // vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
    // vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
    let s0 = b0.floor().mulScalar(new Fixed(36893488147419103232n)).addScalar(one);
    let s1 = b1.floor().mulScalar(new Fixed(36893488147419103232n)).addScalar(one);


    let sh = Vec4.new(
        step(h.x, zero).neg(), 
        step(h.y, zero).neg(), 
        step(h.z, zero).neg(), 
        step(h.w, zero).neg()
    );

    let a0 = Vec4.new(
        b0.x.add(s0.x.mul(sh.x)), b0.z.add(s0.z.mul(sh.x)), b0.y.add(s0.y.mul(sh.y)), b0.w.add(s0.w.mul(sh.y))
    );
    let a1 = Vec4.new(
        b1.x.add(s1.x.mul(sh.z)), b1.z.add(s1.z.mul(sh.z)), b1.y.add(s1.y.mul(sh.w)), b1.w.add(s1.w.mul(sh.w))
    );


    let p0 = Vec3.new(a0.x, a0.y, h.x);
    let p1 = Vec3.new(a0.z, a0.w, h.y);
    let p2 = Vec3.new(a1.x, a1.y, h.z);
    let p3 = Vec3.new(a1.z, a1.w, h.w);


    let norm = taylor_inv_sqrt(Vec4.new(p0.dot(p0), p1.dot(p1), p2.dot(p2), p3.dot(p3)));
    p0 = Vec3.new(p0.x.mul(norm.x), p0.y.mul(norm.x), p0.z.mul(norm.x));
    p1 = Vec3.new(p1.x.mul(norm.y), p1.y.mul(norm.y), p1.z.mul(norm.y));
    p2 = Vec3.new(p2.x.mul(norm.z), p2.y.mul(norm.z), p2.z.mul(norm.z));
    p3 = Vec3.new(p3.x.mul(norm.w), p3.y.mul(norm.w), p3.z.mul(norm.w));

    let m = Vec4.new(
        max(half.sub(x0.dot(x0)), zero),
        max(half.sub(x1.dot(x1)), zero),
        max(half.sub(x2.dot(x2)), zero),
        max(half.sub(x3.dot(x3)), zero)
    );

    // m = (m * m) * (m * m);
    m = m.mul(m).mul(m.mul(m));


    let _105 = FixedTrait.fromInt(105n);
    return _105.mul(m.dot(Vec4.new(p0.dot(x0), p1.dot(x1), p2.dot(x2), p3.dot(x3))));
    
}


export function noise_octaves(v: Vec3, octaves: bigint, persistence: Fixed): Fixed {
    let s = FixedTrait.ONE;
    let t = FixedTrait.ZERO;
    let n = FixedTrait.ZERO;

    while (octaves > 0n) {
        octaves -= 1n;
        n = n.add(noise(v.div(Vec3.splat(s))).mul(s));
        t = t.add(s);
        s = s.mul(persistence);
    }

    return n.div(t);
}