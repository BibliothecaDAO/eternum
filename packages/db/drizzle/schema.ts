import { pgTable, text, numeric, timestamp, index, uuid, varchar, integer, unique, serial, char, jsonb, boolean, foreignKey, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const bridgeEventType = pgEnum("BridgeEventType", ['deposit_initiated_l1', 'deposit_initiated_l2', 'withdraw_available_l1', 'withdraw_completed_l1', 'withdraw_completed_l2'])


export const duneVelordsSupply = pgTable("dune_velords_supply", {
	oldSupply: text("old_supply").notNull(),
	newSupply: numeric("new_supply").notNull(),
	transactionHash: text("transaction_hash").primaryKey().notNull(),
	blockTime: timestamp("block_time", { precision: 3, mode: 'string' }).notNull(),
});

export const delegates = pgTable("delegates", {
	uid: uuid().defaultRandom().primaryKey().notNull(),
	id: varchar({ length: 256 }).notNull(),
	governance: varchar({ length: 256 }),
	user: varchar({ length: 256 }).notNull(),
	delegatedVotesRaw: numeric({ precision: 80, scale:  0 }).notNull(),
	delegatedVotes: numeric({ precision: 80, scale:  20 }).notNull(),
	tokenHoldersRepresentedAmount: integer().notNull(),
	tokenHoldersRepresented: integer().notNull(),
	// TODO: failed to parse database type 'int8range'
	blockRange: unknown("block_range").notNull(),
}, (table) => [
	index("delegates_delegatedvotes_index").using("btree", table.delegatedVotes.asc().nullsLast().op("numeric_ops")),
	index("delegates_delegatedvotesraw_index").using("btree", table.delegatedVotesRaw.asc().nullsLast().op("numeric_ops")),
	index().using("btree", table.governance.asc().nullsLast().op("text_ops")),
	index().using("btree", table.id.asc().nullsLast().op("text_ops")),
	index("delegates_tokenholdersrepresented_index").using("btree", table.tokenHoldersRepresented.asc().nullsLast().op("int4_ops")),
	index("delegates_tokenholdersrepresentedamount_index").using("btree", table.tokenHoldersRepresentedAmount.asc().nullsLast().op("int4_ops")),
	index().using("btree", table.user.asc().nullsLast().op("text_ops")),
]);

export const governances = pgTable("governances", {
	uid: uuid().defaultRandom().primaryKey().notNull(),
	id: varchar({ length: 256 }).notNull(),
	currentDelegates: integer().notNull(),
	totalDelegates: integer().notNull(),
	delegatedVotesRaw: numeric({ precision: 80, scale:  0 }).notNull(),
	delegatedVotes: numeric({ precision: 80, scale:  20 }).notNull(),
}, (table) => [
	index("governances_currentdelegates_index").using("btree", table.currentDelegates.asc().nullsLast().op("int4_ops")),
	index("governances_delegatedvotes_index").using("btree", table.delegatedVotes.asc().nullsLast().op("numeric_ops")),
	index("governances_delegatedvotesraw_index").using("btree", table.delegatedVotesRaw.asc().nullsLast().op("numeric_ops")),
	index().using("btree", table.id.asc().nullsLast().op("text_ops")),
	index("governances_totaldelegates_index").using("btree", table.totalDelegates.asc().nullsLast().op("int4_ops")),
]);

export const realmsBridgeRequests = pgTable("realms_bridge_requests", {
	id: text().primaryKey().notNull(),
	fromChain: text("from_chain").notNull(),
	tokenIds: integer("token_ids").array().notNull(),
	fromAddress: text("from_address").notNull(),
	toAddress: text("to_address").notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
	txHash: text("tx_hash").notNull(),
	reqHash: numeric("req_hash").notNull(),
});

export const delegateProfiles = pgTable("delegate_profiles", {
	id: varchar({ length: 256 }).default(gen_random_uuid()).primaryKey().notNull(),
	delegateId: varchar({ length: 256 }),
	statement: text().notNull(),
	interests: text().array(),
	twitter: text(),
	github: text(),
	telegram: text(),
	discord: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index().using("btree", table.delegateId.asc().nullsLast().op("text_ops")),
	unique("delegate_profiles_delegateId_unique").on(table.delegateId),
]);

export const reorgRollback = pgTable("__reorg_rollback", {
	n: serial().primaryKey().notNull(),
	op: char({ length: 1 }).notNull(),
	tableName: text("table_name").notNull(),
	cursor: integer().notNull(),
	rowId: text("row_id"),
	rowValue: jsonb("row_value"),
	indexerId: text("indexer_id").notNull(),
}, (table) => [
	index("idx_reorg_rollback_indexer_id_cursor").using("btree", table.indexerId.asc().nullsLast().op("int4_ops"), table.cursor.asc().nullsLast().op("int4_ops")),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	address: text(),
}, (table) => [
	unique("user_email_unique").on(table.email),
	unique("user_address_unique").on(table.address),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const indexerSchemaVersion = pgTable("__indexer_schema_version", {
	k: integer().primaryKey().notNull(),
	version: integer().notNull(),
});

export const indexerCheckpoints = pgTable("__indexer_checkpoints", {
	id: text().primaryKey().notNull(),
	orderKey: integer("order_key").notNull(),
	uniqueKey: text("unique_key"),
});

export const realmsBridgeEvents = pgTable("realms_bridge_events", {
	id: text().notNull(),
	hash: text().notNull(),
	type: bridgeEventType().notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.id, table.type], name: "realms_bridge_events_id_type_pk"}),
]);

export const realmsLordsClaims = pgTable("realms_lords_claims", {
	hash: text().notNull(),
	amount: numeric().notNull(),
	recipient: text().notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.hash, table.amount], name: "realms_lords_claims_amount_hash_pk"}),
]);

export const indexerFilters = pgTable("__indexer_filters", {
	id: text().notNull(),
	filter: text().notNull(),
	fromBlock: integer("from_block").notNull(),
	toBlock: integer("to_block"),
}, (table) => [
	primaryKey({ columns: [table.id, table.fromBlock], name: "__indexer_filters_pkey"}),
]);

export const duneVelordsBurns = pgTable("dune_velords_burns", {
	source: text().notNull(),
	amount: numeric().notNull(),
	transactionHash: text("transaction_hash").notNull(),
	epoch: timestamp({ precision: 3, mode: 'string' }).notNull(),
	epochTotalAmount: numeric("epoch_total_amount").notNull(),
	senderEpochTotalAmount: numeric("sender_epoch_total_amount").notNull(),
}, (table) => [
	primaryKey({ columns: [table.amount, table.transactionHash], name: "dune_velords_burns_amount_transaction_hash_pk"}),
]);
