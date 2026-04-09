import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { ApprovedSignal } from "@lumens-news/types";
import { beatEnum } from "@lumens-news/types";

import { signalSchema } from "../lib/openapi/schemas";
import { signal } from "../lib/openapi/tags";

const signalsHandlers = new OpenAPIHono();

const getSignalsRequestQuerySchema = z.object({
  beat: beatEnum.openapi({ description: "Filter by beat" }),
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
  return c.json([], 200);
});

const getSignalRequestParamSchema = z.object({
  signalId: z.string(),
});
const getSignalResponseSchema = signalSchema;

const getSignal = createRoute({
  method: "get",
  path: "/{signalId}",
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
  },
  tags: [signal],
});

signalsHandlers.openapi(getSignal, async (c) => {
  return c.json({} as ApprovedSignal, 200);
});

export { signalsHandlers };
