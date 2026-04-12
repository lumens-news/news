import { Keypair } from "@stellar/stellar-sdk";
import { generateText, Output } from "ai";

import type { EvaluatorConfig, SignalReview, Verdict } from "./types";
import { signRequest } from "./auth";
import { EVALUATOR_SYSTEM_PROMPT } from "./prompts";
import { signalReviewSchema, verdictSchema } from "./types";

/**
 * Fetch pending signals from the lumens.news review queue.
 */
async function fetchPendingSignals(config: EvaluatorConfig): Promise<SignalReview[]> {
  const params = new URLSearchParams({ status: "pending", limit: String(config.limit ?? 50) });
  if (config.beat) params.set("beat", config.beat);

  const path = `/api/signals/review?${params.toString()}`;
  const authHeaders = signRequest(config.secretKey, "GET", "/api/signals/review");

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "GET",
    headers: authHeaders,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch signals for review (${response.status}): ${text}`);
  }

  const data = await response.json();
  return signalReviewSchema.array().parse(data);
}

/**
 * Use AI to evaluate a single signal and return a verdict.
 */
async function evaluateSignal(signal: SignalReview): Promise<Verdict> {
  const model = Bun.env.AI_MODEL ?? "openai/gpt-4o";

  const { output } = await generateText({
    model,
    output: Output.object({ schema: verdictSchema }),
    system: EVALUATOR_SYSTEM_PROMPT,
    prompt: `Evaluate the following signal filed on the "${signal.beat}" beat:

HEADLINE: ${signal.headline}

BODY:
${signal.body}

TAGS: ${signal.tags.join(", ")}

SOURCES:
${signal.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}

Filed at: ${signal.filedAt}
Correspondent: ${signal.correspondent}

Return your verdict as JSON.`,
  });

  return output;
}

/**
 * Approve a signal by publishing it.
 */
async function approveSignal(config: EvaluatorConfig, id: string): Promise<void> {
  const path = `/api/signals/${id}/publish`;
  const authHeaders = signRequest(config.secretKey, "POST", path);

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: authHeaders,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to approve signal ${id} (${response.status}): ${text}`);
  }
}

/**
 * Reject a signal with a reason.
 */
async function rejectSignal(config: EvaluatorConfig, id: string, reason: string): Promise<void> {
  const path = `/api/signals/${id}/reject`;
  const authHeaders = signRequest(config.secretKey, "POST", path);

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to reject signal ${id} (${response.status}): ${text}`);
  }
}

export type EvaluationResult = {
  id: string;
  headline: string;
  beat: string;
  decision: "approve" | "reject";
  reason: string;
};

/**
 * Run the evaluator agent:
 * 1. Fetch pending signals from the review queue
 * 2. Evaluate each with AI
 * 3. Approve or reject based on the verdict
 *
 * Returns the list of evaluation results for inspection.
 */
export async function runEvaluator(config: EvaluatorConfig): Promise<EvaluationResult[]> {
  const address = Keypair.fromSecret(config.secretKey).publicKey();
  console.log(`[evaluator] address=${address}`);
  if (config.beat) console.log(`[evaluator] beat filter=${config.beat}`);

  console.log("[evaluator] fetching pending signals...");
  const signals = await fetchPendingSignals(config);
  console.log(`[evaluator] found ${signals.length} pending signal(s)`);

  if (signals.length === 0) {
    console.log("[evaluator] nothing to review");
    return [];
  }

  const results: EvaluationResult[] = [];

  for (const signal of signals) {
    console.log(`[evaluator] evaluating signal=${signal.id}  beat=${signal.beat}`);
    console.log(`[evaluator]   headline="${signal.headline}"`);

    let verdict: Verdict;
    try {
      verdict = await evaluateSignal(signal);
    } catch (err) {
      console.error(`[evaluator]   failed to evaluate signal ${signal.id}:`, err);
      continue;
    }

    console.log(`[evaluator]   decision=${verdict.decision}  reason="${verdict.reason}"`);

    try {
      if (verdict.decision === "approve") {
        await approveSignal(config, signal.id);
        console.log(`[evaluator]   approved signal ${signal.id}`);
      } else {
        await rejectSignal(config, signal.id, verdict.reason);
        console.log(`[evaluator]   rejected signal ${signal.id}`);
      }
    } catch (err) {
      console.error(`[evaluator]   failed to submit verdict for signal ${signal.id}:`, err);
      continue;
    }

    results.push({
      id: signal.id,
      headline: signal.headline,
      beat: signal.beat,
      decision: verdict.decision,
      reason: verdict.reason,
    });
  }

  const approved = results.filter((r) => r.decision === "approve").length;
  const rejected = results.filter((r) => r.decision === "reject").length;
  console.log(`[evaluator] done — approved=${approved}  rejected=${rejected}`);

  return results;
}
