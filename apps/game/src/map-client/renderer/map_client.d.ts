/* tslint:disable */
/* eslint-disable */

export class MapRenderer {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    backend(): string;
    /**
     * Draws a frame from a camera given as the page's camera holds it: its world matrix and its lens.
     */
    render(camera_world: Float32Array | number[], fov_y_radians: number, near: number, far: number, seconds: number): void;
    resize(width: number, height: number): void;
    /**
     * Replaces the units of one build (knight, crossbowman or paladin): twenty floats a unit.
     */
    set_troop(role: string, instances: Float32Array | number[]): void;
    /**
     * Shows an order as four hexes' middles on the ground, x then z each: the picked army's hex, the two it
     * crosses and the one it is sent to. Anything else clears it.
     */
    show_order(stops: Float32Array | number[]): void;
    /**
     * Starts the renderer on a canvas with the land's table (JSON) and buffer. `force_webgl2` draws on WebGL2
     * even where WebGPU is there. `quality` names the tier: high, mid or low.
     */
    static start(canvas: HTMLCanvasElement, table: string, buffer: Uint8Array | number[], hex_horizontal: number, hex_vertical: number, force_webgl2: boolean, quality: string): Promise<MapRenderer>;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_maprenderer_free: (a: number, b: number) => void;
    readonly maprenderer_backend: (a: number, b: number) => void;
    readonly maprenderer_render: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly maprenderer_resize: (a: number, b: number, c: number) => void;
    readonly maprenderer_set_troop: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly maprenderer_show_order: (a: number, b: number, c: number) => void;
    readonly maprenderer_start: (a: any, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => any;
    readonly __wasm_bindgen_func_elem_7589: (a: number, b: number, c: number, d: any) => void;
    readonly __wasm_bindgen_func_elem_7591: (a: number, b: number, c: any, d: any) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export4: (a: number) => void;
    readonly __wbindgen_export5: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_export6: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export7: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
