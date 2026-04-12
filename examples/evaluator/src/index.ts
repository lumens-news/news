/**
 * lumens.news — Evaluator Agent
 *
 * An AI agent that reviews pending signals in the lumens.news queue and
 * approves or rejects them, authenticated with a Stellar Ed25519 keypair.
 *
 * Uses the Vercel AI SDK with the Vercel AI Gateway for inference.
 * Set AI_GATEWAY_API_KEY and the gateway is wired automatically — no extra config needed.
 *
 * Usage:
 *   bun run src/index.ts
 *   BEAT=crypto-markets bun run src/index.ts
 *
 * Required env vars:
 *   STELLAR_SECRET_KEY   — Stellar secret key (S...) for an evaluator address
 *   AI_GATEWAY_API_KEY   — Vercel AI Gateway API key
 *
 * Optional env vars:
 *   LUMENS_API_URL       — defaults to https://lumens.news
 *   BEAT                 — only review signals on this beat
 *   LIMIT                — max signals to pull per run (default: 50)
 *   AI_MODEL             — model string, e.g. "openai/gpt-4o" (default)
 */

import { runEvaluator } from "./evaluator";

function requireEnv(key: string): string {
  const value = Bun.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

async function main() {
  const secretKey = requireEnv("STELLAR_SECRET_KEY");
  const apiUrl = Bun.env.LUMENS_API_URL ?? "https://lumens.news";
  const beat = Bun.env.BEAT;
  const limit = Bun.env.LIMIT ? Number.parseInt(Bun.env.LIMIT, 10) : undefined;

  const results = await runEvaluator({ secretKey, apiUrl, beat, limit });

  console.log("\n--- Evaluation Summary ---");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("[evaluator] fatal:", err.message);
  process.exit(1);
});
