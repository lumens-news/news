import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { Env } from "../config/env";
import { beats } from "../config/beats";
import * as tables from "../lib/db";
import { buildErrorSchema, buildNotFoundErrorSchema, forbiddenErrorCode, forbiddenErrorDefaultMessage } from "../lib/openapi/errors";
import { addressSchema, beatSchema, idSchema, signalSchema, signalSourceSchema } from "../lib/openapi/schemas";
import { signal } from "../lib/openapi/tags";
import { isEvaluator } from "../middlewares/is-evalutor";
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
      approvedAt: tables.signals.approvedAt,
    })
    .from(tables.signals)
    .where(and(beat ? eq(tables.signals.beat, beat) : undefined, eq(tables.signals.status, "approved"), isNotNull(tables.signals.approvedAt)))
    .orderBy(desc(tables.signals.approvedAt), desc(tables.signals.id))
    .limit(limit)
    .offset((page - 1) * limit);

  const getSignalsResponse = getSignalsResponseSchema.parse(
    signals.map((signal) => ({
      ...signal,
      // biome-ignore lint/style/noNonNullAssertion: sql enforce non-nullable approvedAt
      publishedAt: signal.approvedAt!.toISOString(),
    }))
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
          schema: buildNotFoundErrorSchema("signal").default({
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
      approvedAt: tables.signals.approvedAt,
    })
    .from(tables.signals)
    .where(and(eq(tables.signals.id, id), eq(tables.signals.status, "approved"), isNotNull(tables.signals.approvedAt)));

  if (!signal?.approvedAt) return c.json(buildError("signal_not_found", `Signal with id ${id} not found`), 404);

  const getSignalResponse = getSignalResponseSchema.parse({ ...signal, publishedAt: signal.approvedAt.toISOString() });

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
  description: "File a signal",
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

/* ========== POST /api/signals/:id/publish ========== */
const publishSignalRequestHeaderSchema = z.object({
  "x-stellar-address": addressSchema,
});
const publishSignalRequestParamSchema = z.object({
  id: idSchema,
});

const publishSignal = createRoute({
  method: "post",
  path: "/{id}/publish",
  description: "Publish a signal (evaluator only)",
  // hide: true,
  request: {
    headers: publishSignalRequestHeaderSchema,
    params: publishSignalRequestParamSchema,
  },
  middleware: [(c, next) => isEvaluator(c.req.header("x-stellar-address"))(c, next)],
  responses: {
    200: {
      description: "Signal published",
    },
    400: {
      content: {
        "application/json": {
          schema: buildErrorSchema("signal_already_published", "signal_has_been_rejected").openapi({
            examples: [buildError("signal_already_published", "Signal already published"), buildError("signal_has_been_rejected", "Signal has been rejected")],
          }),
        },
      },
      description: "Signal publish failed",
    },
    403: {
      content: {
        "application/json": {
          schema: buildErrorSchema(forbiddenErrorCode).default({
            error: forbiddenErrorCode,
            message: forbiddenErrorDefaultMessage,
          }),
        },
      },
      description: "Not allowed to publish signal",
    },
    404: {
      content: {
        "application/json": {
          schema: buildNotFoundErrorSchema("signal").default({
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

signalsHandlers.openapi(publishSignal, async (c) => {
  const { "x-stellar-address": address } = c.req.valid("header");
  const { id } = c.req.valid("param");

  const db = drizzle(c.env.LUMENS_DB);

  const [signal] = await db.select({ status: tables.signals.status }).from(tables.signals).where(eq(tables.signals.id, id));
  if (!signal) return c.json(buildError("signal_not_found", `Signal with id ${id} not found`), 404);

  if (signal.status === "approved") return c.json(buildError("signal_already_published", "Signal already published"), 400);
  if (signal.status === "rejected") return c.json(buildError("signal_has_been_rejected", "Signal has been rejected"), 400);

  const result = await db
    .update(tables.signals)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedBy: address,
    })
    .where(and(eq(tables.signals.id, id), eq(tables.signals.status, "pending")));

  if (!result.success) {
    console.error("Failed to update signal:", result);

    return c.json(internalServerError(), 500);
  }

  return c.body(null, 200);
});

/* ======================================== */

/* ========== POST /api/signals/:id/reject ========== */
const rejectSignalRequestHeaderSchema = z.object({
  "x-stellar-address": addressSchema,
});
const rejectSignalRequestParamSchema = z.object({
  id: idSchema,
});
const rejectSignalRequestBodySchema = z.object({
  reason: z.string(),
});

const rejectSignal = createRoute({
  method: "post",
  path: "/{id}/reject",
  description: "Reject a signal (evaluator only)",
  // hide: true,
  request: {
    headers: rejectSignalRequestHeaderSchema,
    params: rejectSignalRequestParamSchema,
    body: {
      content: {
        "application/json": {
          schema: rejectSignalRequestBodySchema,
        },
      },
    },
  },
  middleware: [(c, next) => isEvaluator(c.req.header("x-stellar-address"))(c, next)],
  responses: {
    200: {
      description: "Signal rejected",
    },
    400: {
      content: {
        "application/json": {
          schema: buildErrorSchema("signal_already_rejected", "signal_has_been_published").openapi({
            examples: [buildError("signal_already_rejected", "Signal already rejected"), buildError("signal_has_been_published", "Signal has been published")],
          }),
        },
      },
      description: "Signal rejection failed",
    },
    403: {
      content: {
        "application/json": {
          schema: buildErrorSchema(forbiddenErrorCode).default({
            error: forbiddenErrorCode,
            message: forbiddenErrorDefaultMessage,
          }),
        },
      },
      description: "Not allowed to reject signal",
    },
    404: {
      content: {
        "application/json": {
          schema: buildNotFoundErrorSchema("signal").default({
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

signalsHandlers.openapi(rejectSignal, async (c) => {
  const { "x-stellar-address": address } = c.req.valid("header");
  const { id } = c.req.valid("param");
  const { reason } = c.req.valid("json");

  const db = drizzle(c.env.LUMENS_DB);

  const [signal] = await db.select({ status: tables.signals.status }).from(tables.signals).where(eq(tables.signals.id, id));
  if (!signal) return c.json(buildError("signal_not_found", `Signal with id ${id} not found`), 404);

  if (signal.status === "rejected") return c.json(buildError("signal_already_rejected", "Signal already rejected"), 400);
  if (signal.status === "approved") return c.json(buildError("signal_has_been_published", "Signal has been published"), 400);

  const result = await db
    .update(tables.signals)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: address,
      rejectionReason: reason,
    })
    .where(and(eq(tables.signals.id, id), eq(tables.signals.status, "pending")));

  if (!result.success) {
    console.error("Failed to update signal:", result);

    return c.json(internalServerError(), 500);
  }

  return c.body(null, 200);
});

/* ======================================== */

export { signalsHandlers };
