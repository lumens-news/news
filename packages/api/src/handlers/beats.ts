import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { beats } from "@lumens-news/types";

import { beatSchema } from "../lib/openapi/schemas";
import { beat } from "../lib/openapi/tags";

const beatsHandlers = new OpenAPIHono();

const getBeatsResponseSchema = z.readonly(z.array(beatSchema)).openapi({
  description: "Available topics",
});

const getBeats = createRoute({
  method: "get",
  path: "/",
  description: "Get all available topics",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: getBeatsResponseSchema,
        },
      },
      description: "List all available topics",
    },
  },
  tags: [beat],
});

beatsHandlers.openapi(getBeats, (c) => c.json(beats, 200));

export { beatsHandlers };
