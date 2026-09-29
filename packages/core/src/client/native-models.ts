import type { NativeWorldBindings } from "@bibliothecadao/types";
import type { GameSyncModelDefinition } from "../sync/model-manifest";

/** Persistent rows and ephemeral events share a wire stream but have different recovery rules. */
export function nativeModelDefinition(bindings: NativeWorldBindings): (name: string) => GameSyncModelDefinition {
  const models = new Map(bindings.models.map((model) => [model.name, model]));
  const events = new Map(bindings.events.map((event) => [event.name, event]));
  return (name) => {
    const event = events.get(name);
    const model = event ?? models.get(name);
    if (!model) throw new Error(`Model ${name} is absent from the native deployment schema`);
    return {
      name,
      scope: model.scope,
      deletion: event ? "event-ephemeral" : "component",
    };
  };
}
