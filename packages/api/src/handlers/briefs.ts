import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { resolveNotFoundErrorSchema } from "../lib/openapi/errors";
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

briefsHandlers.openapi(getBrief, (c) => c.json({} as z.infer<typeof getBriefResponseSchema>, 200));

const compileBriefRequestBodySchema = z.object({
  date: z.iso.date().openapi({ description: "Brief date, format: YYYY-MM-DD" }),
  signalIds: z.array(z.uuidv7()),
});

const compileBrief = createRoute({
  method: "post",
  path: "/",
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

briefsHandlers.openapi(compileBrief, (c) => c.body(null, 201));

export { briefsHandlers };
