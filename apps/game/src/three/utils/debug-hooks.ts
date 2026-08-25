const DEBUG_HOOK_REGISTRY_KEY = "__threeDebugHooksRegistry";

type DebugHookTarget = Record<string, unknown> & {
  [DEBUG_HOOK_REGISTRY_KEY]?: Set<string>;
};

export interface DebugHookInstallOptions {
  target?: Record<string, unknown> | null;
  isDev?: boolean;
}

function resolveDefaultTarget(): DebugHookTarget | null {
  if (typeof window !== "undefined") {
    return window as unknown as DebugHookTarget;
  }

  if (typeof globalThis !== "undefined") {
    return globalThis as DebugHookTarget;
  }

  return null;
}

function resolveIsDev(options: DebugHookInstallOptions): boolean {
  if (typeof options.isDev === "boolean") {
    return options.isDev;
  }

  return Boolean(import.meta.env?.DEV);
}

function resolveTarget(options: DebugHookInstallOptions): DebugHookTarget | null {
  if (options.target) {
    return options.target as DebugHookTarget;
  }

  return resolveDefaultTarget();
}

function getOrCreateRegistry(target: DebugHookTarget): Set<string> {
  if (!target[DEBUG_HOOK_REGISTRY_KEY]) {
    target[DEBUG_HOOK_REGISTRY_KEY] = new Set<string>();
  }

  return target[DEBUG_HOOK_REGISTRY_KEY]!;
}

export function registerDebugHook(name: string, hook: unknown, options: DebugHookInstallOptions = {}): boolean {
  if (!resolveIsDev(options)) {
    return false;
  }

  const target = resolveTarget(options);
  if (!target) {
    return false;
  }

  target[name] = hook;
  getOrCreateRegistry(target).add(name);
  return true;
}

export function unregisterDebugHook(name: string, options: DebugHookInstallOptions = {}): void {
  const target = resolveTarget(options);
  if (!target) {
    return;
  }

  delete target[name];
  target[DEBUG_HOOK_REGISTRY_KEY]?.delete(name);
}

export function getRegisteredDebugHooks(options: DebugHookInstallOptions = {}): string[] {
  const target = resolveTarget(options);
  if (!target) {
    return [];
  }

  return Array.from(target[DEBUG_HOOK_REGISTRY_KEY] ?? []).sort();
}
