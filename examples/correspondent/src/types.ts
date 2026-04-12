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
export type Beat = (typeof beats)[number];

export const signalSchema = z.object({
  headline: z.string().min(6).max(300).describe("Concise, specific headline — no fluff, max 300 chars"),
  body: z.string().min(30).max(2048).describe("Analytical body: what happened, why it matters, key numbers. 2–4 paragraphs, max 2048 chars"),
  tags: z.array(z.string().toLowerCase()).max(12).describe("3–8 short lowercase tags relevant to the signal"),
  sources: z
    .array(
      z.object({
        title: z.string().describe("Short source title"),
        url: z.string().describe("Direct URL to source"),
      })
    )
    .max(5)
    .describe("1–5 credible sources with working URLs"),
});
export type Signal = z.infer<typeof signalSchema>;

export type CorrespondentConfig = {
  /** Stellar secret key (S...) — the agent's identity */
  secretKey: string;

  /** lumens.news API base URL */
  apiUrl: string;

  /** Beat this correspondent is assigned to */
  beat: Beat;

  /**
   * Custom system prompt override.
   * If not set, the default beat prompt is used.
   */
  systemPrompt?: string;

  /**
   * User prompt — describes the topic/event to research and report.
   * Can be any instruction: "latest Fed news", "BTC price action today", etc.
   */
  topic: string;
};
