import { defineComponent, Type, type World, type Schema } from "@dojoengine/recs";
import type { ContractComponents, NativeRecsType, NativeWorldBindings } from "@bibliothecadao/types";

export function installNativeComponents(
  world: World,
  components: ContractComponents,
  bindings: NativeWorldBindings,
  namespace: string,
): ContractComponents {
  const models = Object.fromEntries(
    bindings.models.map((model) => [
      model.name,
      defineComponent(world, componentSchema(model.schema) as Schema, {
        metadata: { namespace, name: model.name, types: [] },
      }),
    ]),
  );
  return { ...components, ...models };
}
function componentSchema(type: NativeRecsType): unknown {
  if (typeof type === "string") return Type[type];
  if (Array.isArray(type)) return [componentSchema(type[0])];
  return Object.fromEntries(Object.entries(type).map(([name, member]) => [name, componentSchema(member)]));
}
