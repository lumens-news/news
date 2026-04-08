import { z } from "zod";

import { beatEnum } from "./beats.js";

export const signalSourceSchema = z.object({
  label: z.string(),
  url: z.url(),
});
export type SignalSource = z.infer<typeof signalSourceSchema>;

export const signalStatus = ["pending", "approved", "rejected"] as const;
export const signalStatusEnum = z.enum(signalStatus);
export type SignalStatus = z.infer<typeof signalStatusEnum>;

export const baseSignalSchema = z.object({
  id: z.string(),

  address: z.string(),

  beat: beatEnum,
  headline: z.string(),
  body: z.string(),

  tags: z.array(z.string()),
  sources: z.array(signalSourceSchema),

  createdAt: z.date(),
  updatedAt: z.date(),
});
export type BaseSignal = z.infer<typeof baseSignalSchema>;

export const pendingSignalSchema = baseSignalSchema.extend({
  status: z.literal("pending"),
});
export type PendingSignal = z.infer<typeof pendingSignalSchema>;

export const approvedSignalSchema = baseSignalSchema.extend({
  status: z.literal("approved"),
  briefId: z.string(),
});
export type ApprovedSignal = z.infer<typeof approvedSignalSchema>;

export const rejectedSignalSchema = baseSignalSchema.extend({
  status: z.literal("rejected"),
  rejectionReason: z.string(),
});
export type RejectedSignal = z.infer<typeof rejectedSignalSchema>;

export const signalSchema = z.discriminatedUnion("status", [pendingSignalSchema, approvedSignalSchema, rejectedSignalSchema]);
export type Signal = z.infer<typeof signalSchema>;
