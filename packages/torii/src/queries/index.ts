// Query strategy:
// - Use SQL queries for single model queries (better performance)
// - Use Torii client for multi-model queries

export * from "./sql";
export * from "./torii-client";
