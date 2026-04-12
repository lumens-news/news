import { z } from "zod";

export const signalStatuses = ["pending", "approved", "rejected"] as const;
export type SignalStatus = (typeof signalStatuses)[number];

export const signalSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

export const signalReviewSchema = z.object({
  id: z.string(),
  correspondent: z.string(),
  beat: z.string(),
  headline: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  sources: z.array(signalSourceSchema),
  status: z.enum(signalStatuses),
  filedAt: z.string(),
});
export type SignalReview = z.infer<typeof signalReviewSchema>;

export const verdictSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().describe("Brief reasoning for the decision (required for rejections, useful for approvals too)"),
});
export type Verdict = z.infer<typeof verdictSchema>;

export type EvaluatorConfig = {
  /** Stellar secret key (S...) — the evaluator's identity */
  secretKey: string;

  /** lumens.news API base URL */
  apiUrl: string;

  /** Only evaluate signals on this beat (undefined = all beats) */
  beat?: string;

  /** Max signals to pull per run (default: 50) */
  limit?: number;
};
