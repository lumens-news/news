import { z } from "zod";

export const beats = [
  "macro",
  "crypto-markets",
  "defi",
  "equities",
  "on-chain",
  "regulation",
  "commodities",
  "sentiment",
  "stellar-ecosystem",
  "risk-events",
] as const;

export const beatEnum = z.enum(beats);
export type Beat = z.infer<typeof beatEnum>;
