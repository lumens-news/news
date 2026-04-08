import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { beatEnum, beats } from "@lumens-news/types";

const beatsHandlers = new OpenAPIHono();

const beatSchema = beatEnum.openapi("Beat");

const getBeats = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(beatSchema).openapi({
            example: beats,
          }),
        },
      },
      description: "List all topics",
    },
  },
  tags: ["Beat"],
});

beatsHandlers.openapi(getBeats, (c) => c.json(beats, 200));

export { beatsHandlers };
