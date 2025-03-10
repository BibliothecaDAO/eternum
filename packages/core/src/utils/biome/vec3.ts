import { Fixed } from "./fixed-point";
export class Vec3 {
  constructor(
    public x: Fixed,
    public y: Fixed,
    public z: Fixed,
  ) {}

  static new(x: Fixed, y: Fixed, z: Fixed): Vec3 {
    return new Vec3(x, y, z);
  }

  static splat(v: Fixed): Vec3 {
    return new Vec3(v, v, v);
  }

  dot(other: Vec3): Fixed {
    let x = this.x.mul(other.x);
    let y = this.y.mul(other.y);
    let z = this.z.mul(other.z);
    return x.add(y).add(z);
  }

  minus(other: Vec3): Vec3 {
    return new Vec3(this.x.sub(other.x), this.y.sub(other.y), this.z.sub(other.z));
  }

  add(other: Vec3): Vec3 {
    return new Vec3(this.x.add(other.x), this.y.add(other.y), this.z.add(other.z));
  }

  mul(other: Vec3): Vec3 {
    return new Vec3(this.x.mul(other.x), this.y.mul(other.y), this.z.mul(other.z));
  }

  mod(other: Vec3): Vec3 {
    return new Vec3(this.x.mod(other.x), this.y.mod(other.y), this.z.mod(other.z));
  }

  div(other: Vec3): Vec3 {
    return new Vec3(this.x.div(other.x), this.y.div(other.y), this.z.div(other.z));
  }

  floor(): Vec3 {
    return new Vec3(this.x.floor(), this.y.floor(), this.z.floor());
  }

  remScaler(scalar: Fixed): Vec3 {
    return new Vec3(this.x.mod(scalar), this.y.mod(scalar), this.z.mod(scalar));
  }

  divScalar(scalar: Fixed): Vec3 {
    return new Vec3(this.x.div(scalar), this.y.div(scalar), this.z.div(scalar));
  }

  mulScalar(scalar: Fixed): Vec3 {
    return new Vec3(this.x.mul(scalar), this.y.mul(scalar), this.z.mul(scalar));
  }

  addScalar(scalar: Fixed): Vec3 {
    return new Vec3(this.x.add(scalar), this.y.add(scalar), this.z.add(scalar));
  }

  abs(): Vec3 {
    return new Vec3(this.x.abs(), this.y.abs(), this.z.abs());
  }
}
