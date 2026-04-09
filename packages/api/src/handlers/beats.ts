import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { beats } from "../config/beats";
import { beatSchema } from "../lib/openapi/schemas";
import { beat } from "../lib/openapi/tags";

const beatsHandlers = new OpenAPIHono();

/* ========== GET /api/beats ========== */

const getBeatsResponseSchema = z.array(beatSchema).openapi({ example: beats });

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

beatsHandlers.openapi(getBeats, (c) => c.json(Array.from(beats), 200));

/* ======================================== */

export { beatsHandlers };
