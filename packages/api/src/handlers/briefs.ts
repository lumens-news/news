import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { v7 } from "uuid";

import type { Env } from "../config/env";
import type { StellarAuthVariables } from "../middlewares/stellar-auth";
import * as tables from "../lib/db";
import { buildErrorSchema, buildNotFoundErrorSchema } from "../lib/openapi/errors";
import { briefSchema, idSchema, paymentProofSchema, paymentRequiredSchema, paymentSettledSchema, stellarAuthSchema } from "../lib/openapi/schemas";
import { brief } from "../lib/openapi/tags";
import { isEvaluator, onlyEvaluatorErrorCode, onlyEvaluatorErrorMessage } from "../middlewares/is-evaluator";
import { invalidAuthSignatureErrorCode, invalidAuthSignatureErrorMessage, stellarAuth } from "../middlewares/stellar-auth";
import { x402Payment } from "../middlewares/x402";
import { buildError, internalServerError } from "../utils/error";

const briefsHandlers = new OpenAPIHono<Env & StellarAuthVariables>();

/* ========== GET /api/briefs/:date ========== */
const getBriefRequestParamSchema = z.object({
  date: z.iso.date().openapi({ description: "Brief date, format: YYYY-MM-DD" }),
});
const getBriefResponseSchema = briefSchema;

const getBrief = createRoute({
  method: "get",
  path: "/{date}",
  description: "Get brief by date",
  request: {
    headers: paymentProofSchema,
    params: getBriefRequestParamSchema,
  },
  middleware: [x402Payment({ price: "$0.1", description: "Get daily brief full content" })],
  responses: {
    200: {
      headers: paymentSettledSchema,
      content: {
        "application/json": {
          schema: getBriefResponseSchema,
        },
      },
      description: "Brief by date",
    },
    402: {
      headers: paymentRequiredSchema,
      description: "Payment required to access brief",
    },
    404: {
      content: {
        "application/json": {
          schema: buildNotFoundErrorSchema("brief").default({
            error: "brief_not_found",
            message: "Brief with date YYYY-MM-DD was not found",
          }),
        },
      },
      description: "Brief not found",
    },
  },
  tags: [brief],
});

briefsHandlers.openapi(getBrief, async (c) => {
  const { date } = c.req.valid("param");

  const db = drizzle(c.env.LUMENS_DB);

  const [brief, ...rest] = await db
    .select({
      id: tables.briefs.id,
      date: tables.briefs.date,
      compiledBy: tables.briefs.compiledBy,
      signal: {
        id: tables.signals.id,
        correspondent: tables.signals.correspondent,
        beat: tables.signals.beat,
        headline: tables.signals.headline,
        body: tables.signals.body,
        tags: tables.signals.tags,
        sources: tables.signals.sources,
        approvedAt: tables.signals.approvedAt,
      },
    })
    .from(tables.briefs)
    .innerJoin(tables.briefSignals, eq(tables.briefSignals.briefId, tables.briefs.id))
    .innerJoin(tables.signals, eq(tables.signals.id, tables.briefSignals.signalId))
    .where(eq(tables.briefs.date, new Date(date)));

  if (!brief) return c.json(buildError("brief_not_found", `Brief with date ${date} not found`), 404);

  // biome-ignore lint/style/noNonNullAssertion: approvedAt are always available since briefs only contain approved signals
  const signals = [brief, ...rest].map((r) => ({ ...r.signal, publishedAt: r.signal.approvedAt!.toISOString() }));

  const getBriefResponse = getBriefResponseSchema.parse({ ...brief, date, signals });

  return c.json(getBriefResponse, 200);
});

/* ======================================== */

/* ========== POST /api/briefs/compile ========== */
const compileBriefRequestBodySchema = z.object({
  date: z.iso.date().openapi({ description: "Brief date, format: YYYY-MM-DD" }),
  signalIds: z.array(idSchema),
});

const compileBrief = createRoute({
  method: "post",
  path: "/compile",
  description: "Compile brief (evaluator only)",
  request: {
    headers: stellarAuthSchema,
    body: {
      content: {
        "application/json": {
          schema: compileBriefRequestBodySchema,
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
    201: {
      description: "Brief compiled successfully",
    },
    400: {
      description: "Invalid signals ids",
      content: {
        "application/json": {
          schema: buildErrorSchema("invalid_signal_ids").default({
            error: "invalid_signal_ids",
            message: "Invalid signal ids provided",
          }),
        },
      },
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
      description: "Compile brief authorization failed",
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
      description: "Not allowed to compile brief",
    },
    409: {
      description: "Brief already compiled",
      content: {
        "application/json": {
          schema: buildErrorSchema("brief_already_compiled").default({
            error: "brief_already_compiled",
            message: "Brief date YYYY-MM-DD has been compiled",
          }),
        },
      },
    },
  },
  tags: [brief],
});

briefsHandlers.openapi(compileBrief, async (c) => {
  const { date, signalIds } = c.req.valid("json");

  const db = drizzle(c.env.LUMENS_DB);

  const resolvedDate = new Date(date);

  const [existingBrief] = await db.select().from(tables.briefs).where(eq(tables.briefs.date, resolvedDate));
  if (existingBrief) return c.json(buildError("brief_already_compiled", `Brief date ${date} has been compiled`), 409);

  const requestedSignalIds = [...new Set(signalIds)];

  const signals = await db
    .select({ id: tables.signals.id })
    .from(tables.signals)
    .where(and(inArray(tables.signals.id, requestedSignalIds), eq(tables.signals.status, "approved")));

  if (signals.length !== requestedSignalIds.length) return c.json(buildError("invalid_signal_ids", "Invalid signal ids provided"), 400);

  const briefId = v7();

  const batchResult = await db.batch([
    db
      .insert(tables.briefs)
      .values({ id: briefId, date: resolvedDate, compiledBy: c.get("stellarAddress") })
      .onConflictDoNothing(),
    ...signals.map(({ id: signalId }) => db.insert(tables.briefSignals).values({ briefId, signalId }).onConflictDoNothing()),
  ]);

  return batchResult.every((r) => r.success) ? c.body(null, 201) : c.json(internalServerError(), 500);
});

/* ======================================== */

export { briefsHandlers };
