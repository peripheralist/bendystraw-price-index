import { sql } from "drizzle-orm";
import * as t from "drizzle-orm/pg-core";

export const price = t.pgTable(
  "price",
  {
    token: t.varchar("token", { length: 42 }).notNull(),
    timestamp: t.integer("timestamp").notNull(),
    chainId: t.integer("chainId").notNull(),
    priceUsd: t.doublePrecision(),
  },
  (table) => [
    t.primaryKey({ columns: [table.token, table.chainId, table.timestamp] }),
    t.check("address_check_format", sql`${table.token} LIKE '0x%'`),
  ]
);
