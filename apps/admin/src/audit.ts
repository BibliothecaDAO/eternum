import type { Environment } from "./env";

/** One operator action as the Audit screen lists it. */
export interface AuditRow {
  id: number;
  at: number;
  email: string;
  environment: Environment;
  action: string;
  request: string;
  state: "sent" | "done" | "failed";
  status: number | null;
  response: string | null;
}

const RESPONSE_LIMIT = 2_000;

/**
 * Records each action before it is sent and completes it after, so a call that crashed half-way still shows, as sent.
 */
export class AuditLog {
  constructor(private readonly db: D1Database) {}

  async sent(entry: Pick<AuditRow, "email" | "environment" | "action" | "request">, at: number): Promise<number> {
    const row = await this.db
      .prepare(
        "INSERT INTO actions (at, email, environment, action, request, state) VALUES (?, ?, ?, ?, ?, 'sent') RETURNING id",
      )
      .bind(at, entry.email, entry.environment, entry.action, entry.request)
      .first<{ id: number }>();
    if (!row) throw new Error("Audit row was not written");
    return row.id;
  }

  async answered(id: number, status: number, response: string): Promise<void> {
    await this.db
      .prepare("UPDATE actions SET state = 'done', status = ?, response = ? WHERE id = ?")
      .bind(status, response.slice(0, RESPONSE_LIMIT), id)
      .run();
  }

  async failed(id: number, message: string): Promise<void> {
    await this.db
      .prepare("UPDATE actions SET state = 'failed', response = ? WHERE id = ?")
      .bind(message.slice(0, RESPONSE_LIMIT), id)
      .run();
  }

  async latest(limit: number): Promise<AuditRow[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM actions ORDER BY id DESC LIMIT ?")
      .bind(limit)
      .all<AuditRow>();
    return results;
  }
}
