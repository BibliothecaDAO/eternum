import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";

import { ACTION_CATALOG, ACTION_NAMES, type ActionCatalogEntry, type ActionName } from "./action-catalog";
import { textResult } from "./result";

const ListActionsParams = Type.Object({
  keyword: Type.Optional(
    Type.String({ description: "Only actions whose name, description, or preconditions mention this word." }),
  ),
});

export const createListActionsTool = (): AgentTool<typeof ListActionsParams> => ({
  name: "list_actions",
  label: "List actions",
  description: "The actions I can take through act, with their parameters and preconditions.",
  parameters: ListActionsParams,
  execute: async (_id, params) => {
    const names = filterActions(params.keyword);
    const text =
      names.length === 0
        ? `No action matches "${params.keyword}". Try list_actions without a keyword.`
        : names.map((name) => renderAction(name, ACTION_CATALOG[name])).join("\n\n");
    return textResult(text, { actions: names });
  },
});

export const filterActions = (keyword: string | undefined): ActionName[] => {
  if (!keyword) return ACTION_NAMES;
  const needle = keyword.toLowerCase();
  return ACTION_NAMES.filter((name) => {
    const entry = ACTION_CATALOG[name];
    return [name, entry.description, entry.preconditions].some((text) => text.toLowerCase().includes(needle));
  });
};

const renderAction = (name: ActionName, entry: ActionCatalogEntry): string =>
  [
    `${name}${entry.submits ? "" : " (read-only)"}: ${entry.description}`,
    `  params: ${renderParams(entry)}`,
    `  preconditions: ${entry.preconditions}`,
  ].join("\n");

const renderParams = (entry: ActionCatalogEntry): string =>
  Object.entries(entry.params.properties)
    .map(([key, schema]) => `${key}${entry.params.required?.includes(key) ? "" : "?"}: ${describeSchema(schema)}`)
    .join(", ");

const describeSchema = (schema: {
  type?: string;
  description?: string;
  enum?: unknown[];
  anyOf?: unknown[];
}): string => {
  const kind = schema.enum ? `one of ${schema.enum.join("|")}` : (schema.type ?? "value");
  return schema.description ? `${kind} — ${schema.description}` : kind;
};
