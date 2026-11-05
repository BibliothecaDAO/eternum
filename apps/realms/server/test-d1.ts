import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import { Miniflare } from "miniflare";

/**
 * A D1 database in workerd for Worker tests, reached by one request per statement or batch. Miniflare's binding proxy
 * (getD1Database, getPlatformProxy) blocks the test on a round trip to workerd for every prepare, every bind and the
 * first read of each statement's methods, about five per statement: the referral tests' 226 statements took 2.4 s
 * locally and over 5 s on CI.
 */
export function createTestD1() {
  const worker = new Miniflare({ modules: true, script: RUNNER, d1Databases: ["DB"] });
  const send = async (request: D1Request) => {
    const response = await worker.dispatchFetch("http://d1.test/", { method: "POST", body: JSON.stringify(request) });
    const reply = (await response.json()) as { value: unknown } | { error: string };
    if ("error" in reply) throw new Error(reply.error);
    return reply.value;
  };
  const db = {
    prepare: (sql: string) => preparedStatement(send, { sql, params: [] }),
    batch: (statements: D1PreparedStatement[]) => send({ op: "batch", queries: statements.map(queryOf) }),
    exec: (sql: string) => send({ op: "exec", sql }),
  } as unknown as D1Database;
  return { db, close: () => disposeWorker(worker) };
}

type Param = string | number | boolean | null;
interface Query {
  sql: string;
  params: Param[];
}
type D1Request =
  | { op: "all" | "run"; queries: [Query] }
  | { op: "first"; queries: [Query]; column?: string | undefined }
  | { op: "batch"; queries: Query[] }
  | { op: "exec"; sql: string };

const queries = new WeakMap<object, Query>();
const queryOf = (statement: D1PreparedStatement): Query => {
  const query = queries.get(statement);
  if (!query) throw new TypeError("D1 batch takes only statements this database prepared");
  return query;
};

const preparedStatement = (send: (request: D1Request) => Promise<unknown>, query: Query): D1PreparedStatement => {
  const statement = {
    bind: (...params: unknown[]) => preparedStatement(send, { sql: query.sql, params: params.map(bindable) }),
    first: (column?: string) => send({ op: "first", queries: [query], column }),
    all: () => send({ op: "all", queries: [query] }),
    run: () => send({ op: "run", queries: [query] }),
  };
  queries.set(statement, query);
  return statement as unknown as D1PreparedStatement;
};

/** D1 binds only these; anything else fails as D1 fails it, rather than reaching workerd changed by JSON. */
const bindable = (value: unknown): Param => {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value as Param;
  throw new TypeError(`D1_TYPE_ERROR: Type '${typeof value}' not supported`);
};

/** The Worker holding the binding: runs each request's statements and answers their result or D1's error. */
const RUNNER = `
export default {
  async fetch(request, env) {
    const { op, queries = [], sql, column } = await request.json();
    try {
      const bound = queries.map((query) => env.DB.prepare(query.sql).bind(...query.params));
      const value =
        op === "batch" ? await env.DB.batch(bound)
        : op === "exec" ? await env.DB.exec(sql)
        : op === "first" ? await (column === undefined ? bound[0].first() : bound[0].first(column))
        : await bound[0][op]();
      return Response.json({ value });
    } catch (error) {
      return Response.json({ error: error.message });
    }
  },
};
`;
