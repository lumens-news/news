import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { briefSchema } from "../lib/openapi/schemas";
import { brief } from "../lib/openapi/tags";

const briefsHandlers = new OpenAPIHono();

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
  },
  tags: [brief],
});

briefsHandlers.openapi(getBrief, (c) => c.json({} as z.infer<typeof getBriefResponseSchema>, 200));

export { briefsHandlers };
