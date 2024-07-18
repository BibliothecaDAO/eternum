// copy pasta from https://github.com/gizatechxyz/orion/tree/main/src/operators

trait NumberTrait<T, MAG> {
    fn abs(self: T) -> T;
}


impl i128Number of NumberTrait<i128, i128> {
    fn abs(self: i128) -> i128 {
        if self >= 0 {
            return self;
        } else {
            self * -1_i128
        }
    }
}
