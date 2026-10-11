import { dlopen, FFIType, ptr } from "bun:ffi";

const { symbols } = dlopen("libc.so.6", {
  clock_gettime: { args: [FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
});
const time = new BigInt64Array(2);

export function now(): bigint {
  if (symbols.clock_gettime(1, ptr(time)) !== 0) throw new Error("Monotonic clock unavailable");
  return time[0]! * 1_000_000_000n + time[1]!;
}
