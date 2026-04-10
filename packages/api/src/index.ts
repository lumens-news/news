import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import { HTTPException } from "hono/http-exception";

import type { Env } from "./config/env";
import { beatsHandlers } from "./handlers/beats";
import { briefsHandlers } from "./handlers/briefs";
import { signalsHandlers } from "./handlers/signals";
import { internalServerError } from "./utils/error";

const app = new OpenAPIHono<Env>();

app.route("/api/beats", beatsHandlers).route("/api/briefs", briefsHandlers).route("/api/signals", signalsHandlers);

const openApiDoc = app.getOpenAPI31Document({
  openapi: "3.1.1",
  info: {
    version: "1.0.0",
    title: "lumens.news API doc",
  },
});

app
  .doc31("/openapi.json", (c) => ({
    ...openApiDoc,
    servers: [
      {
        url: new URL(c.req.url).origin,
        description: "Current environment",
      },
    ],
  }))
  .get("/docs", Scalar({ url: "/openapi.json" }))
  .get("/llms.txt", async (c) => c.text(await createMarkdownFromOpenApi(JSON.stringify(openApiDoc))));

app
  .get("/", (c) =>
    c.json(
      {
        title: "lumens.news API",
        version: "1.0.0",
      },
      200
    )
  )
  .get("/health", (c) => c.text("OK", 200));

app.onError(async (err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  console.error(err);

  return c.json(internalServerError(), 500);
});

export default app;
