import { z } from "@hono/zod-openapi";

import { beats } from "../../config/beats";

export const beatSchema = z.enum(beats).openapi("Beat");

export const addressSchema = z.string().openapi("Address");

export const signalSourceSchema = z
  .object({
    label: z.string(),
    url: z.url(),
  })
  .openapi("SignalSource");
export const signalSchema = z
  .object({
    id: z.uuidv7(),

    correspondent: addressSchema,

    beat: beatSchema,
    headline: z.string(),
    body: z.string(),

    tags: z.array(z.string()),
    sources: z.array(signalSourceSchema),

    createdAt: z.date(),
  })
  .openapi("Signal");

export const briefSchema = z
  .object({
    id: z.uuidv7(),
    date: z.iso.date(),
    signals: z.array(signalSchema),
    compiledBy: addressSchema,
  })
  .openapi("Brief");
