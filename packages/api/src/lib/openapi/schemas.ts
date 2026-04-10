import { z } from "@hono/zod-openapi";

import { beats } from "../../config/beats";

export const beatSchema = z.enum(beats).openapi("Beat");

export const addressSchema = z.string().openapi("Address");

export const idSchema = z.string().openapi("ID", { example: "123e4567-e89b-12d3-a456-426614174000" });

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

    filedAt: z.iso.datetime(),
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
