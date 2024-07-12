import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const visits = sqliteTable("visits", {
  id: integer("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
});
