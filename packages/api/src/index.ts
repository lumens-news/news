import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";

import { beatsHandlers } from "./handlers/beats";
import { signalsHandlers } from "./handlers/signals";

const app = new OpenAPIHono();

app.route("/api/beats", beatsHandlers).route("/api/signals", signalsHandlers);

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

export default app;
