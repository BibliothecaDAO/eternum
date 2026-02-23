const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// Monorepo root (3 levels up from client/apps/game-native)
const monorepoRoot = path.resolve(__dirname, '../../..');

// Path to our WASM shim (covers torii-wasm, controller-wasm, account-wasm)
const wasmShim = path.resolve(__dirname, 'src/shims/torii-wasm.js');

// All WASM-based packages that need shimming
const WASM_PACKAGES = [
  '@dojoengine/torii-wasm',
  '@cartridge/controller-wasm',
  '@cartridge/account-wasm',
];

const config = {
  // Watch the monorepo root for changes in shared packages
  watchFolders: [monorepoRoot],

  resolver: {
    // Let Metro find node_modules in both the app and monorepo root
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Avoid duplicate React instances - force resolution from app's node_modules
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    },
    // Don't try to resolve .web.js files in native context
    resolverMainFields: ['react-native', 'main', 'module'],
    // Block patterns that won't work in RN
    blockList: [
      // Exclude other apps' node_modules to avoid conflicts
      /client\/apps\/(?!game-native).*\/node_modules\/.*/,
    ],
    // Custom resolver to intercept all WASM module imports
    resolveRequest: (context, moduleName, platform) => {
      // Redirect any WASM-based package imports to our shim
      if (WASM_PACKAGES.some(pkg => moduleName === pkg || moduleName.startsWith(pkg + '/'))) {
        return {
          filePath: wasmShim,
          type: 'sourceFile',
        };
      }
      // Block .wasm file resolution
      if (moduleName.endsWith('.wasm')) {
        return {
          filePath: wasmShim,
          type: 'sourceFile',
        };
      }
      // Let Metro handle everything else
      return context.resolveRequest(context, moduleName, platform);
    },
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
