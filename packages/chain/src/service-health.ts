export interface ServiceDependency {
  name: string;
  ok: boolean;
  code: string | null;
}

const NAME = /^[a-z][a-z0-9-]{0,39}$/;
const CODE = /^[a-z][a-z0-9_]{0,79}$/;

export const dependencyUp = (name: string): ServiceDependency => ({
  name,
  ok: true,
  code: null,
});
export const dependencyDown = (
  name: string,
  code: string,
): ServiceDependency => ({ name, ok: false, code });

export async function readThroughDependency<Value>(
  name: string,
  read: () => Promise<Value>,
  codeOf: (error: unknown) => string,
): Promise<{ dependency: ServiceDependency; value: Value | null }> {
  try {
    return { dependency: dependencyUp(name), value: await read() };
  } catch (error) {
    return { dependency: dependencyDown(name, codeOf(error)), value: null };
  }
}

export function serviceDependencies(body: {
  dependencies?: unknown;
}): ServiceDependency[] {
  const { dependencies } = body;
  if (
    !Array.isArray(dependencies) ||
    !dependencies.length ||
    !dependencies.every(isServiceDependency)
  )
    throw new Error("service_dependencies_malformed");
  return dependencies;
}

function isServiceDependency(value: unknown): value is ServiceDependency {
  if (!value || typeof value !== "object") return false;
  const { name, ok, code, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length || typeof name !== "string" || !NAME.test(name))
    return false;
  if (ok === true) return code === null;
  return ok === false && typeof code === "string" && CODE.test(code);
}
