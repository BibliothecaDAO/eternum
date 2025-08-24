export type Telemetry = {
  span<T>(name: string, attributes: Record<string, any> | undefined, fn: () => T | Promise<T>): T | Promise<T>;
  event(name: string, attributes?: Record<string, any>): void;
  counter?(name: string, value?: number, attributes?: Record<string, any>): void;
};

// No-op implementation used by default
const noopSpan = <T>(_name: string, _attrs: Record<string, any> | undefined, fn: () => T | Promise<T>) => fn();
const noopEvent = (_name: string, _attrs?: Record<string, any>) => {};
const noopCounter = (_name: string, _value: number = 1, _attrs?: Record<string, any>) => {};

let current: Telemetry = {
  span: noopSpan,
  event: noopEvent,
  counter: noopCounter,
};

export function setTelemetry(adapter: Partial<Telemetry>) {
  current = {
    span: adapter.span || noopSpan,
    event: adapter.event || noopEvent,
    counter: adapter.counter || noopCounter,
  };
}

export function getTelemetry(): Telemetry {
  return current;
}

export const telemetry = {
  span: <T>(name: string, attributes: Record<string, any> | undefined, fn: () => T | Promise<T>) =>
    current.span(name, attributes, fn),
  event: (name: string, attributes?: Record<string, any>) => current.event(name, attributes),
  counter: (name: string, value: number = 1, attributes?: Record<string, any>) =>
    (current.counter || noopCounter)(name, value, attributes),
};
