import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { Env } from "../config/env";
import { beats } from "../config/beats";
import * as tables from "../lib/db";
import { resolveNotFoundErrorSchema } from "../lib/openapi/errors";
import { addressSchema, beatSchema, idSchema, signalSchema, signalSourceSchema } from "../lib/openapi/schemas";
import { signal } from "../lib/openapi/tags";
import { buildError, internalServerError } from "../utils/error";

const signalsHandlers = new OpenAPIHono<Env>();

/* ========== GET /api/signals ========== */
const getSignalsRequestQuerySchema = z.object({
  beat: z.enum(beats).openapi({ description: "Filter by beat" }).optional(),
  page: z.int().min(1).default(1).openapi({ description: "Page" }),
  limit: z.int().min(1).max(100).default(50).openapi({ description: "Limit per page" }),
});
const getSignalsResponseSchema = z.array(signalSchema);

const getSignals = createRoute({
  method: "get",
  path: "/",
  description: "Get signals",
  request: {
    query: getSignalsRequestQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: getSignalsResponseSchema,
        },
      },
      description: "List of signals",
    },
  },
  tags: [signal],
});

signalsHandlers.openapi(getSignals, async (c) => {
  const { beat, page, limit } = c.req.valid("query");

  const db = drizzle(c.env.LUMENS_DB);

  const signals = await db
    .select({
      id: tables.signals.id,
      correspondent: tables.signals.correspondent,
      beat: tables.signals.beat,
      headline: tables.signals.headline,
      body: tables.signals.body,
      tags: tables.signals.tags,
      sources: tables.signals.sources,
      filedAt: tables.signals.filedAt,
    })
    .from(tables.signals)
    .where(and(beat ? eq(tables.signals.beat, beat) : undefined, eq(tables.signals.status, "approved")))
    .limit(limit)
    .offset((page - 1) * limit);

  const getSignalsResponse = signals.reduce(
    (acc, signal) => {
      const parseSignalResult = signalSchema.safeParse({ ...signal, filedAt: signal.filedAt.toISOString() });
      if (!parseSignalResult.success) return acc;

      acc.push(parseSignalResult.data);
      return acc;
    },
    [] as z.infer<typeof getSignalsResponseSchema>
  );

  return c.json(getSignalsResponse, 200);
});

/* ======================================== */

/* ========== GET /api/signals/:id ========== */
const getSignalRequestParamSchema = z.object({
  id: idSchema,
});
const getSignalResponseSchema = signalSchema;

const getSignal = createRoute({
  method: "get",
  path: "/{id}",
  description: "Get signal by id",
  request: {
    params: getSignalRequestParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: getSignalResponseSchema,
        },
      },
      description: "Signal detail",
    },
    404: {
      content: {
        "application/json": {
          schema: resolveNotFoundErrorSchema("signal").default({
            error: "signal_not_found",
            message: "Signal with id X was not found",
          }),
        },
      },
      description: "Signal not found",
    },
  },
  tags: [signal],
});

signalsHandlers.openapi(getSignal, async (c) => {
  const { id } = c.req.valid("param");

  const db = drizzle(c.env.LUMENS_DB);

  const [signal] = await db
    .select({
      id: tables.signals.id,
      correspondent: tables.signals.correspondent,
      beat: tables.signals.beat,
      headline: tables.signals.headline,
      body: tables.signals.body,
      tags: tables.signals.tags,
      sources: tables.signals.sources,
      filedAt: tables.signals.filedAt,
    })
    .from(tables.signals)
    .where(and(eq(tables.signals.id, id), eq(tables.signals.status, "approved")));

  if (!signal) return c.json(buildError("signal_not_found", `Signal with id ${id} not found`), 404);

  const getSignalResponse = getSignalResponseSchema.parse(signal);

  return c.json(getSignalResponse, 200);
});

/* ======================================== */

/* ========== POST /api/signals ========== */
const fileSignalRequestHeaderSchema = z.object({
  "x-stellar-address": addressSchema,
});
const fileSignalRequestBodySchema = z.object({
  beat: beatSchema,
  headline: z.string().min(6).max(300),
  body: z.string().min(30).max(2048),
  tags: z.array(z.string()).max(12),
  sources: z.array(signalSourceSchema).max(100),
});

const fileSignal = createRoute({
  method: "post",
  path: "/",
  request: {
    headers: fileSignalRequestHeaderSchema,
    body: {
      content: {
        "application/json": {
          schema: fileSignalRequestBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Signal filed",
    },
  },
  tags: [signal],
});

signalsHandlers.openapi(fileSignal, async (c) => {
  const { "x-stellar-address": address } = c.req.valid("header");
  const { beat, headline, body, tags, sources } = c.req.valid("json");

  const db = drizzle(c.env.LUMENS_DB);

  const result = await db.insert(tables.signals).values({
    correspondent: address,
    beat,
    headline,
    body,
    tags,
    sources,
  });

  if (!result.success) {
    console.error("Failed to insert signal:", result);

    return c.json(internalServerError(), 500);
  }

  return c.body(null, 201);
});

/* ======================================== */

export { signalsHandlers };
