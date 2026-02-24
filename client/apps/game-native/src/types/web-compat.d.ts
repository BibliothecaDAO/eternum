// Type declarations for DOM APIs referenced by shared packages
// These types are available in web but not in React Native's TypeScript config.
// The actual runtime behavior is handled by polyfills or platform-specific code.

declare class MessageEvent<T = any> extends Event {
  readonly data: T;
  readonly lastEventId: string;
  readonly origin: string;
}

declare class CloseEvent extends Event {
  readonly code: number;
  readonly reason: string;
  readonly wasClean: boolean;
}

declare class URL {
  constructor(url: string, base?: string);
  hash: string;
  host: string;
  hostname: string;
  href: string;
  readonly origin: string;
  password: string;
  pathname: string;
  port: string;
  protocol: string;
  search: string;
  readonly searchParams: URLSearchParams;
  username: string;
  toString(): string;
  toJSON(): string;
}

declare class URLSearchParams {
  constructor(init?: string | Record<string, string> | string[][]);
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  set(name: string, value: string): void;
  toString(): string;
  forEach(
    callback: (value: string, key: string, parent: URLSearchParams) => void,
  ): void;
}

// Extend WebSocket to support EventListenerOptions (3rd arg) used by shared packages
interface EventListenerOptions {
  once?: boolean;
  passive?: boolean;
  capture?: boolean;
}

interface WebSocket {
  addEventListener(
    type: string,
    listener: (event: any) => void,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: any) => void,
    options?: EventListenerOptions | boolean,
  ): void;
}
