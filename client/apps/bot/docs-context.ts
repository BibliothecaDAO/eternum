import { action, context } from "@daydreamsai/core";

import { z } from "zod";

import llmtxt from "./llm.txt";

export const docsContext = context({
  type: "docs",
  schema: z.object({
    id: z.string(),
  }),
  description: "Documentation for eternum.",
  key({ id }) {
    return id;
  },
  maxWorkingMemorySize: 2,
}).setActions([
  action({
    name: "eternum:documentation",
    description: "If you ever need to reference the documentation, you can use this action.",
    schema: z.object({
      query: z.string(),
    }),
    async handler({ query }, agent, ctx) {
      return {
        content: llmtxt,
      };
    },
  }),
]);
