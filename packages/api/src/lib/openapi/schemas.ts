import { z } from "@hono/zod-openapi";

import { beats } from "../../config/beats";

export const beatSchema = z.enum(beats).openapi("Beat");

export const addressSchema = z.string().openapi("Address");

export const idSchema = z.uuidv7().openapi("ID", { example: "018f4f47-1f9d-7c13-bd3d-a2f5e857e5db" });

export const signalSourceSchema = z
  .object({
    title: z.string(),
    url: z.url(),
  })
  .openapi("SignalSource");
export const signalSchema = z
  .object({
    id: idSchema,

    correspondent: addressSchema,

    beat: beatSchema,
    headline: z.string(),
    body: z.string(),

    tags: z.array(z.string()),
    sources: z.array(signalSourceSchema),

    publishedAt: z.iso.datetime(),
  })
  .openapi("Signal");

export const briefSchema = z
  .object({
    id: idSchema,
    date: z.iso.date(),
    signals: z.array(signalSchema),
    compiledBy: addressSchema,
  })
  .openapi("Brief");
