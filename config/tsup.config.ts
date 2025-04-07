import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['deployer/index.ts'],
  format: ['esm'], // Changed to ESM format to support top-level await
  dts: true,
  clean: true,
  sourcemap: true,
  esbuildOptions(options) {
    // Add loader for wasm files
    options.loader = {
      ...options.loader,
      '.wasm': 'file'
    };
  },
}); 