import type { Options } from 'tsup'

export const tsupConfig: Options = {
    entry: ["src/index.ts"],
    target: "esnext",
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: true,
}