import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { Env } from "../config/env";
import * as tables from "../lib/db";
import { resolveNotFoundErrorSchema } from "../lib/openapi/errors";
import { briefSchema, idSchema } from "../lib/openapi/schemas";
import { brief } from "../lib/openapi/tags";
import { buildError } from "../utils/error";

const briefsHandlers = new OpenAPIHono<Env>();

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
    params: getBriefRequestParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: getBriefResponseSchema,
        },
      },
      description: "Brief by date",
    },
    404: {
      content: {
        "application/json": {
          schema: resolveNotFoundErrorSchema("brief").default({
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

  const getBriefResponse = getBriefResponseSchema.parse({ ...brief, signals });

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
  description: "Compile brief",
  request: {
    body: {
      content: {
        "application/json": {
          schema: compileBriefRequestBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Brief compiled successfully",
    },
  },
  tags: [brief],
});

briefsHandlers.openapi(compileBrief, async (c) => {
  return c.body(null, 201);
});

/* ======================================== */

export { briefsHandlers };
