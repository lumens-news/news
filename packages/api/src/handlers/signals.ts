import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { beats } from "../config/beats";
import { resolveNotFoundErrorSchema } from "../lib/openapi/errors";
import { signalSchema } from "../lib/openapi/schemas";
import { signal } from "../lib/openapi/tags";

const signalsHandlers = new OpenAPIHono();

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
  return c.json([], 200);
});

const getSignalRequestParamSchema = z.object({
  id: z.uuidv7(),
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
  return c.json({} as z.infer<typeof getSignalResponseSchema>, 200);
});

export { signalsHandlers };
