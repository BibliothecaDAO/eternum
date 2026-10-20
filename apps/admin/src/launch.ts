import { operatorRequest } from "@bibliothecadao/eternum/realms-account";
import type { AdminConfig } from "./env";

type Send = (url: string, init?: RequestInit) => Promise<Response>;

/** The launch service's answer, passed back to the page as it came. */
export interface LaunchAnswer {
  status: number;
  body: string;
}

/** The environment's launch service: public reads, and writes under its operator token. */
export class LaunchService {
  constructor(
    private readonly target: Pick<AdminConfig, "origin" | "operatorToken">,
    private readonly send: Send,
  ) {}

  async read<T>(path: string): Promise<T> {
    const response = await this.send(`${this.target.origin}${path}`, { redirect: "manual" });
    if (!response.ok) throw new Error(`${path} answered ${response.status}`);
    return (await response.json()) as T;
  }

  async write(method: "POST" | "PUT", path: string, body: string | null): Promise<LaunchAnswer> {
    const response = await operatorRequest(
      `${this.target.origin}${path}`,
      this.target.operatorToken,
      { method, body, headers: body === null ? {} : { "content-type": "application/json" } },
      this.send,
    );
    return { status: response.status, body: await response.text() };
  }
}
