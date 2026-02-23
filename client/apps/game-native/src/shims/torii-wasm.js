/**
 * Shim for WASM modules that don't work in React Native's Hermes runtime.
 *
 * This covers:
 * - @dojoengine/torii-wasm (entity queries)
 * - @cartridge/controller-wasm (wallet/account)
 * - @cartridge/account-wasm (wallet/account)
 *
 * The actual data path uses HTTP SQL queries for Torii,
 * and the Cartridge Controller SDK needs a WebView-based fallback.
 */

const WASM_NOT_SUPPORTED_MSG =
  'WASM modules are not supported in React Native. Use HTTP alternatives.';

export class ToriiClient {
  constructor() {
    console.warn(WASM_NOT_SUPPORTED_MSG);
  }
}

export const Query = {};
export const PatternMatching = {};
export const Pagination = {};
export const PaginationDirection = {};
export const Clause = {};
export const OrderBy = {};

// Cartridge controller stubs
export class CartridgeAccount {
  constructor() {
    console.warn(WASM_NOT_SUPPORTED_MSG);
  }
}

export class SessionAccount {
  constructor() {
    console.warn(WASM_NOT_SUPPORTED_MSG);
  }
}

export default {
  ToriiClient,
  Query,
  PatternMatching,
  CartridgeAccount,
  SessionAccount,
};
