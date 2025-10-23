import type { EntityMetadata, MapLocation } from "@bibliothecadao/types";
export declare const noteVisibilityEnum: import("drizzle-orm/pg-core").PgEnum<["public", "private"]>;
export declare const notes: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "notes";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "notes";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 191;
        }>;
        authorId: import("drizzle-orm/pg-core").PgColumn<{
            name: "author_id";
            tableName: "notes";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 191;
        }>;
        zoneId: import("drizzle-orm/pg-core").PgColumn<{
            name: "zone_id";
            tableName: "notes";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 128;
        }>;
        title: import("drizzle-orm/pg-core").PgColumn<{
            name: "title";
            tableName: "notes";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 120;
        }>;
        content: import("drizzle-orm/pg-core").PgColumn<{
            name: "content";
            tableName: "notes";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 2000;
        }>;
        location: import("drizzle-orm/pg-core").PgColumn<{
            name: "location";
            tableName: "notes";
            dataType: "json";
            columnType: "PgJsonb";
            data: MapLocation;
            driverParam: unknown;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: MapLocation;
        }>;
        visibility: import("drizzle-orm/pg-core").PgColumn<{
            name: "visibility";
            tableName: "notes";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "public" | "private";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["public", "private"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        metadata: import("drizzle-orm/pg-core").PgColumn<{
            name: "metadata";
            tableName: "notes";
            dataType: "json";
            columnType: "PgJsonb";
            data: EntityMetadata | null;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: EntityMetadata | null;
        }>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "notes";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "notes";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        expiresAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "expires_at";
            tableName: "notes";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export type Note = typeof notes.$inferSelect;
export type NoteInsert = typeof notes.$inferInsert;
export declare const noteValidator: import("zod").ZodObject<{
    id: import("zod").ZodString;
    authorId: import("zod").ZodString;
    zoneId: import("zod").ZodString;
    title: import("zod").ZodString;
    content: import("zod").ZodString;
    location: import("zod").ZodObject<{
        x: import("zod").ZodNumber;
        y: import("zod").ZodNumber;
        z: import("zod").ZodOptional<import("zod").ZodNumber>;
    }, import("zod/v4/core").$strip>;
    createdAt: import("zod").ZodUnion<readonly [import("zod").ZodDate, import("zod").ZodString]>;
    updatedAt: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodDate, import("zod").ZodString]>>;
    expiresAt: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodDate, import("zod").ZodString]>>;
    metadata: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
}, import("zod/v4/core").$strip>;
