import { z } from "@hono/zod-openapi";

import { signalStatuses } from "@lumens-news/types";

import { beats } from "../../config/beats";

export const beatSchema = z.enum(beats).openapi("Beat");

export const addressSchema = z.string().openapi("Address");

export const stellarAuthSchema = z
  .object({
    "x-stellar-address": addressSchema,
    "x-stellar-signature": z.base64(),
    "x-stellar-timestamp": z.coerce.number().int(),
  })
  .openapi("StellarAuth");

export const idSchema = z.uuidv7().openapi("ID", { example: "018f4f47-1f9d-7c13-bd3d-a2f5e857e5db" });

export const paymentRequiredSchema = z
  .object({
    "payment-required": z.base64(),
  })
  .openapi("PaymentRequired");

export const paymentProofSchema = z
  .object({
    "payment-signature": z.base64().optional(),
  })
  .openapi("PaymentProof");

export const paymentSettledSchema = z
  .object({
    "payment-response": z.base64(),
  })
  .openapi("PaymentSettled");

export const signalSourceSchema = z
  .object({
    title: z.string(),
    url: z.url(),
  })
  .openapi("SignalSource");
export const signalPreviewSchema = z
  .object({
    id: idSchema,

    correspondent: addressSchema,

    beat: beatSchema,
    headline: z.string(),

    tags: z.array(z.string()),

    publishedAt: z.iso.datetime(),
  })
  .openapi("SignalPreview");
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

export const signalStatusSchema = z.enum(signalStatuses).openapi("SignalStatus");

export const signalReviewSchema = z
  .object({
    id: idSchema,

    correspondent: addressSchema,

    beat: beatSchema,
    headline: z.string(),
    body: z.string(),

    tags: z.array(z.string()),
    sources: z.array(signalSourceSchema),

    status: signalStatusSchema,
    filedAt: z.iso.datetime(),
  })
  .openapi("SignalReview");

export const briefSchema = z
  .object({
    id: idSchema,
    date: z.iso.date(),
    signals: z.array(signalSchema),
    compiledBy: addressSchema,
  })
  .openapi("Brief");
