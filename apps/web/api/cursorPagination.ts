import type { AnyColumn, SQL } from "@realms-world/db";
import { and, asc, desc, eq, gt, lt, or } from "@realms-world/db";

// With multiple cursors
export function withCursorPagination<
  PrimaryColumn extends AnyColumn,
  // Make sure the secondary column is from the same table as the primary column:
  TableColumns extends PrimaryColumn["table"]["_"]["columns"],
  SecondaryColumn extends TableColumns[keyof TableColumns],
  PrimaryCursor extends
    | ReturnType<PrimaryColumn["mapFromDriverValue"]>
    | undefined,
  SecondaryCursor extends
    | ReturnType<SecondaryColumn["mapFromDriverValue"]>
    | undefined,
  Order extends "asc" | "desc",
>({
  cursors,
  limit,
  where: inputWhere,
}: { limit: number; where?: SQL } & (
  | {
      cursors: [[PrimaryColumn, Order] | [PrimaryColumn, Order, PrimaryCursor]]; // A single unique + sequential field
    }
  | {
      cursors: [
        [PrimaryColumn, Order] | [PrimaryColumn, Order, PrimaryCursor], // A non-unique sequential field
        [SecondaryColumn, Order] | [SecondaryColumn, Order, SecondaryCursor], // A unique field
      ];
    }
)): {
  orderBy: SQL[];
  limit: number;
  where?: SQL;
} {
  // Primary cursor
  const primaryColumn = cursors[0][0];
  const primaryOrder = cursors[0][1] === "asc" ? asc : desc;
  const primaryOperator = cursors[0][1] === "asc" ? gt : lt;
  const primaryCursor = cursors[0][2];

  // Secondary cursor (unique fallback like an id field for a stable sort)
  const secondaryColumn = cursors[1] ? cursors[1][0] : null;
  const secondaryOrder = cursors[1]
    ? cursors[1][1] === "asc"
      ? asc
      : desc
    : null;
  const secondaryOperator = cursors[1]
    ? cursors[1][1] === "asc"
      ? gt
      : lt
    : null;
  const secondaryCursor = cursors[1] ? cursors[1][2] : undefined;

  // Single cursor pagination
  const singleColumnPaginationWhere =
    typeof primaryCursor !== "undefined"
      ? primaryOperator(primaryColumn, primaryCursor)
      : undefined;

  // Double cursor pagination
  const doubleColumnPaginationWhere =
    secondaryColumn &&
    secondaryOperator &&
    typeof primaryCursor !== "undefined" &&
    typeof secondaryCursor !== "undefined"
      ? or(
          primaryOperator(primaryColumn, primaryCursor),
          and(
            eq(primaryColumn, primaryCursor),
            secondaryOperator(secondaryColumn, secondaryCursor),
          ),
        )
      : undefined;

  // Generate the final where clause
  const paginationWhere = secondaryColumn
    ? doubleColumnPaginationWhere
    : singleColumnPaginationWhere;

  const where = inputWhere
    ? paginationWhere
      ? and(inputWhere, paginationWhere)
      : inputWhere
    : paginationWhere;

  // Return object which can be easily spread into a query
  return {
    orderBy: [
      primaryOrder(primaryColumn),
      ...(secondaryColumn && secondaryOrder
        ? [secondaryOrder(secondaryColumn)]
        : []),
    ],
    limit,
    ...(where ? { where } : {}),
  };
}
