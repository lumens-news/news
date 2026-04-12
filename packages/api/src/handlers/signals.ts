import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { Env } from "../config/env";
import type { EvaluatorVariables } from "../middlewares/is-evaluator";
import type { StellarAuthVariables } from "../middlewares/stellar-auth";
import { beats } from "../config/beats";
import * as tables from "../lib/db";
import { buildErrorSchema, buildNotFoundErrorSchema } from "../lib/openapi/errors";
import {
  beatSchema,
  idSchema,
  paymentProofSchema,
  paymentRequiredSchema,
  paymentSettledSchema,
  signalPreviewSchema,
  signalReviewSchema,
  signalSchema,
  signalSourceSchema,
  signalStatusSchema,
  stellarAuthSchema,
} from "../lib/openapi/schemas";
import { signal } from "../lib/openapi/tags";
import { isEvaluator, onlyEvaluatorErrorCode, onlyEvaluatorErrorMessage } from "../middlewares/is-evaluator";
import { invalidAuthSignatureErrorCode, invalidAuthSignatureErrorMessage, stellarAuth } from "../middlewares/stellar-auth";
import { x402Payment } from "../middlewares/x402";
import { buildError, internalServerError } from "../utils/error";

const signalsHandlers = new OpenAPIHono<Env & StellarAuthVariables & EvaluatorVariables>();

/* ========== GET /api/signals ========== */
const getSignalsRequestQuerySchema = z.object({
  beat: z.enum(beats).openapi({ description: "Filter by beat" }).optional(),
  page: z.int().min(1).default(1).openapi({ description: "Page" }),
  limit: z.int().min(1).max(100).default(50).openapi({ description: "Limit per page" }),
});
const getSignalsResponseSchema = z.array(signalPreviewSchema);

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
      tags: tables.signals.tags,
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
    headers: paymentProofSchema,
    params: getSignalRequestParamSchema,
  },
  middleware: [x402Payment({ price: "$0.01", description: "Get specific signal content" })],
  responses: {
    200: {
      headers: paymentSettledSchema,
      content: {
        "application/json": {
          schema: getSignalResponseSchema,
        },
      },
      description: "Signal detail",
    },
    402: {
      headers: paymentRequiredSchema,
      description: "Payment required to access signal",
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

/* ========== GET /api/signals/review ========== */
const getSignalsForReviewRequestQuerySchema = z.object({
  beat: z.enum(beats).openapi({ description: "Filter by beat" }).optional(),
  status: signalStatusSchema.openapi({ description: "Filter by status" }).optional(),
  page: z.int().min(1).default(1).openapi({ description: "Page" }),
  limit: z.int().min(1).max(100).default(50).openapi({ description: "Limit per page" }),
});
const getSignalsForReviewResponseSchema = z.array(signalReviewSchema);

const getSignalsForReview = createRoute({
  method: "get",
  path: "/review",
  description: "Get signals for review (evaluator only)",
  request: {
    headers: stellarAuthSchema,
    query: getSignalsForReviewRequestQuerySchema,
  },
  middleware: [
    (c, next) => {
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const address = c.req.header("x-stellar-address")!;
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const signature = c.req.header("x-stellar-signature")!;
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const timestamp = c.req.header("x-stellar-timestamp")!;

      return stellarAuth({ address, signature, timestamp })(c, next);
    },
    (c, next) => isEvaluator(c.req.header("x-stellar-address"))(c, next),
  ],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: getSignalsForReviewResponseSchema,
        },
      },
      description: "List of signals for review",
    },
    401: {
      content: {
        "application/json": {
          schema: buildErrorSchema(invalidAuthSignatureErrorCode).openapi({
            examples: [
              {
                error: invalidAuthSignatureErrorCode,
                message: invalidAuthSignatureErrorMessage,
              },
            ],
          }),
        },
      },
      description: "Review signals authorization failed",
    },
    403: {
      content: {
        "application/json": {
          schema: buildErrorSchema(onlyEvaluatorErrorCode).openapi({
            examples: [
              {
                error: onlyEvaluatorErrorCode,
                message: onlyEvaluatorErrorMessage,
              },
            ],
          }),
        },
      },
      description: "Not allowed to review signals",
    },
  },
  tags: [signal],
});

signalsHandlers.openapi(getSignalsForReview, async (c) => {
  const { beat, status, page, limit } = c.req.valid("query");

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
      status: tables.signals.status,
      filedAt: tables.signals.filedAt,
    })
    .from(tables.signals)
    .where(and(beat ? eq(tables.signals.beat, beat) : undefined, status ? eq(tables.signals.status, status) : undefined))
    .orderBy(desc(tables.signals.filedAt), desc(tables.signals.id))
    .limit(limit)
    .offset((page - 1) * limit);

  const getSignalsForReviewResponse = getSignalsForReviewResponseSchema.parse(
    signals.map((signal) => ({
      ...signal,
      filedAt: signal.filedAt.toISOString(),
    }))
  );

  return c.json(getSignalsForReviewResponse, 200);
});

/* ======================================== */

/* ========== POST /api/signals ========== */
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
    headers: stellarAuthSchema,
    body: {
      content: {
        "application/json": {
          schema: fileSignalRequestBodySchema,
        },
      },
    },
  },
  middleware: [
    (c, next) => {
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const address = c.req.header("x-stellar-address")!;
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const signature = c.req.header("x-stellar-signature")!;
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const timestamp = c.req.header("x-stellar-timestamp")!;

      return stellarAuth({ address, signature, timestamp })(c, next);
    },
  ],
  responses: {
    201: {
      description: "Signal filed",
    },
    401: {
      content: {
        "application/json": {
          schema: buildErrorSchema(invalidAuthSignatureErrorCode).openapi({
            examples: [
              {
                error: invalidAuthSignatureErrorCode,
                message: invalidAuthSignatureErrorMessage,
              },
            ],
          }),
        },
      },
      description: "File signal authorization failed",
    },
  },
  tags: [signal],
});

signalsHandlers.openapi(fileSignal, async (c) => {
  const { beat, headline, body, tags, sources } = c.req.valid("json");

  const db = drizzle(c.env.LUMENS_DB);

  const result = await db.insert(tables.signals).values({
    correspondent: c.get("stellarAddress"),
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
const publishSignalRequestParamSchema = z.object({
  id: idSchema,
});

const publishSignal = createRoute({
  method: "post",
  path: "/{id}/publish",
  description: "Publish a signal (evaluator only)",
  // hide: true,
  request: {
    headers: stellarAuthSchema,
    params: publishSignalRequestParamSchema,
  },
  middleware: [
    (c, next) => {
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const address = c.req.header("x-stellar-address")!;
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const signature = c.req.header("x-stellar-signature")!;
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const timestamp = c.req.header("x-stellar-timestamp")!;

      return stellarAuth({ address, signature, timestamp })(c, next);
    },
    (c, next) => isEvaluator(c.req.header("x-stellar-address"))(c, next),
  ],
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
    401: {
      content: {
        "application/json": {
          schema: buildErrorSchema(invalidAuthSignatureErrorCode).openapi({
            examples: [
              {
                error: invalidAuthSignatureErrorCode,
                message: invalidAuthSignatureErrorMessage,
              },
            ],
          }),
        },
      },
      description: "Publish signal authorization failed",
    },
    403: {
      content: {
        "application/json": {
          schema: buildErrorSchema(onlyEvaluatorErrorCode).openapi({
            examples: [
              {
                error: onlyEvaluatorErrorCode,
                message: onlyEvaluatorErrorMessage,
              },
            ],
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
      approvedBy: c.get("stellarAddress"),
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
const rejectSignalRequestParamSchema = z.object({
  id: idSchema,
});
const rejectSignalRequestBodySchema = z.object({
  reason: z.string().min(1).max(1024),
});

const rejectSignal = createRoute({
  method: "post",
  path: "/{id}/reject",
  description: "Reject a signal (evaluator only)",
  // hide: true,
  request: {
    headers: stellarAuthSchema,
    params: rejectSignalRequestParamSchema,
    body: {
      content: {
        "application/json": {
          schema: rejectSignalRequestBodySchema,
        },
      },
    },
  },
  middleware: [
    (c, next) => {
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const address = c.req.header("x-stellar-address")!;
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const signature = c.req.header("x-stellar-signature")!;
      // biome-ignore lint/style/noNonNullAssertion: validated through request schema
      const timestamp = c.req.header("x-stellar-timestamp")!;

      return stellarAuth({ address, signature, timestamp })(c, next);
    },
    (c, next) => isEvaluator(c.req.header("x-stellar-address"))(c, next),
  ],
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
    401: {
      content: {
        "application/json": {
          schema: buildErrorSchema(invalidAuthSignatureErrorCode).openapi({
            examples: [
              {
                error: invalidAuthSignatureErrorCode,
                message: invalidAuthSignatureErrorMessage,
              },
            ],
          }),
        },
      },
      description: "Reject signal authorization failed",
    },
    403: {
      content: {
        "application/json": {
          schema: buildErrorSchema(onlyEvaluatorErrorCode).openapi({
            examples: [
              {
                error: onlyEvaluatorErrorCode,
                message: onlyEvaluatorErrorMessage,
              },
            ],
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
      rejectedBy: c.get("stellarAddress"),
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
