import { index, int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v7 } from "uuid";

import type { SignalSource } from "@lumens-news/types";
import { signalStatuses } from "@lumens-news/types";

export const signals = sqliteTable(
  "signals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => v7()),

    correspondent: text("correspondent").notNull(),

    beat: text("beat").notNull(),
    headline: text("headline").notNull(),
    body: text("body").notNull(),

    tags: text("tags", { mode: "json" }).notNull().$type<string[]>(),
    sources: text("sources", { mode: "json" }).notNull().$type<SignalSource>(),

    status: text("status", { enum: signalStatuses }).notNull().default("pending"),

    filedAt: int("filedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),

    approvedAt: int("approvedAt", { mode: "timestamp_ms" }),

    rejectedAt: int("rejectedAt", { mode: "timestamp_ms" }),
    rejectionReason: text("rejection_reason"),

    createdAt: int("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),

    updatedAt: int("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("index_signal_correspondent").on(t.correspondent),
    index("index_signal_beat").on(t.beat),
    index("index_signal_correspondent_status").on(t.correspondent, t.status),
  ]
);
