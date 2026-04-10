import { int, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { v7 } from "uuid";

import { signals } from "./signals";

export const briefs = sqliteTable(
  "briefs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => v7()),
    date: int("date", { mode: "timestamp" }).notNull().unique(),
    compiledBy: text("compiled_by").notNull(),

    createdAt: int("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),

    updatedAt: int("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("unique_index_brief_date").on(t.date)]
);

export const briefSignals = sqliteTable(
  "brief_signals",
  {
    briefId: text("brief_id").references(() => briefs.id),
    signalId: text("signal_id").references(() => signals.id),
  },
  (t) => [primaryKey({ name: "brief_signal_primary_key", columns: [t.briefId, t.signalId] })]
);
