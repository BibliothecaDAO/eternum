import { Fixed } from "./fixed-point";

export class Vec4 {
    constructor(
        public x: Fixed,
        public y: Fixed,
        public z: Fixed,
        public w: Fixed
    ) {}

    static new(x: Fixed, y: Fixed, z: Fixed, w: Fixed): Vec4 {
        return new Vec4(x, y, z, w);
    }

    static splat(v: Fixed): Vec4 {
        return new Vec4(v, v, v, v);
    }

    dot(other: Vec4): Fixed {
        let x = this.x.mul(other.x);
        let y = this.y.mul(other.y);
        let z = this.z.mul(other.z);
        let w = this.w.mul(other.w);
        return x.add(y).add(z).add(w);
    }

    minus(other: Vec4): Vec4 {
        return new Vec4(this.x.sub(other.x), this.y.sub(other.y), this.z.sub(other.z), this.w.sub(other.w));
    }   

    add(other: Vec4): Vec4 {
        return new Vec4(this.x.add(other.x), this.y.add(other.y), this.z.add(other.z), this.w.add(other.w));
    }

    mul(other: Vec4): Vec4 {
        return new Vec4(this.x.mul(other.x), this.y.mul(other.y), this.z.mul(other.z), this.w.mul(other.w));
    }

    mod(other: Vec4): Vec4 {
        return new Vec4(this.x.mod(other.x), this.y.mod(other.y), this.z.mod(other.z), this.w.mod(other.w));
    }

    div(other: Vec4): Vec4 {
        return new Vec4(this.x.div(other.x), this.y.div(other.y), this.z.div(other.z), this.w.div(other.w));
    }

    floor(): Vec4 {
        return new Vec4(this.x.floor(), this.y.floor(), this.z.floor(), this.w.floor());
    }


    remScaler(scalar: Fixed): Vec4 {
        return new Vec4(this.x.mod(scalar), this.y.mod(scalar), this.z.mod(scalar), this.w.mod(scalar));
    }

    divScalar(scalar: Fixed): Vec4 {
        return new Vec4(this.x.div(scalar), this.y.div(scalar), this.z.div(scalar), this.w.div(scalar));
    }

    mulScalar(scalar: Fixed): Vec4 {
        return new Vec4(this.x.mul(scalar), this.y.mul(scalar), this.z.mul(scalar), this.w.mul(scalar));
    }

    addScalar(scalar: Fixed): Vec4 {
        return new Vec4(this.x.add(scalar), this.y.add(scalar), this.z.add(scalar), this.w.add(scalar));
    }

    abs(): Vec4 {
        return new Vec4(this.x.abs(), this.y.abs(), this.z.abs(), this.w.abs());
    }
}
