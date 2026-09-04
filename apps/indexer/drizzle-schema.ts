import type { TablesRelationalConfig } from "drizzle-orm";
import { createTableRelationsHelpers, extractTablesRelationalConfig } from "drizzle-orm";

/**
 * Converts Drizzle table definitions into the relational table metadata that
 * Apibara's Drizzle plugin reads during indexer initialization.
 */
export function getRelationalSchema(schema: Record<string, unknown>): TablesRelationalConfig {
  return extractTablesRelationalConfig<TablesRelationalConfig>(schema, createTableRelationsHelpers).tables;
}
