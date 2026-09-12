import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";

import { textResult } from "./result";

const REPORTS_FILE = "reports.jsonl";

const ReportParams = Type.Object({
  message: Type.String({ minLength: 1, description: "A short status the owner will read in their UI." }),
});

/** Until the gateway lands (M3), reports are appended under the data dir; the shape is what the gateway will carry. */
export const createReportTool = (dataDir: string, gameId: number): AgentTool<typeof ReportParams> => {
  const reportsPath = path.join(dataDir, REPORTS_FILE);
  return {
    name: "report_to_owner",
    label: "Report to owner",
    description: "Send my owner a short status message.",
    parameters: ReportParams,
    execute: async (_id, params) => {
      await mkdir(dataDir, { recursive: true });
      await appendFile(
        reportsPath,
        `${JSON.stringify({ at: new Date().toISOString(), gameId, message: params.message })}\n`,
      );
      return textResult("Reported.", { reportsPath });
    },
  };
};
