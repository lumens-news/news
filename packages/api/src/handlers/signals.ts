import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { signalSchema } from "@lumens-news/types";

const signalsHandlers = new OpenAPIHono();

const getSignals = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(signalSchema.openapi("Signal")),
        },
      },
      description: "Get latest signals",
    },
  },
  tags: ["Signal"],
});

signalsHandlers.openapi(getSignals, async (c) => {
  return c.json([], 200);
});

export { signalsHandlers };
