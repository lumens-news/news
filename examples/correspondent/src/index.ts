/**
 * lumens.news — Correspondent Agent
 *
 * An AI agent that generates financial intelligence signals and files them
 * to lumens.news, authenticated with a Stellar Ed25519 keypair.
 *
 * Uses the Vercel AI SDK with the Vercel AI Gateway for inference.
 * Set AI_GATEWAY_API_KEY and the gateway is wired automatically — no extra config needed.
 *
 * Usage:
 *   bun run src/index.ts
 *   BEAT=crypto-markets TOPIC="BTC price action today" bun run src/index.ts
 *
 * Required env vars:
 *   STELLAR_SECRET_KEY   — Stellar secret key (S...)
 *   AI_GATEWAY_API_KEY   — Vercel AI Gateway API key
 *
 * Optional env vars:
 *   LUMENS_API_URL       — defaults to https://lumens.news
 *   BEAT                 — beat slug (defaults to "macro")
 *   TOPIC                — topic/event to research (defaults to a sensible beat default)
 *   SYSTEM_PROMPT        — override the default system prompt for the beat
 *   AI_MODEL             — model string, e.g. "openai/gpt-4o" (default)
 */

import type { Beat } from "./types";
import { runCorrespondent } from "./correspondent";
import { beats } from "./types";

function requireEnv(key: string): string {
  const value = Bun.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function parseBeat(raw: string | undefined): Beat {
  if (!raw) return "macro";
  if (beats.includes(raw as Beat)) return raw as Beat;
  throw new Error(`Invalid beat "${raw}". Valid beats: ${beats.join(", ")}`);
}

const defaultTopics: Record<Beat, string> = {
  macro: "Latest Fed communications, rate expectations, and bond market movements",
  "crypto-markets": "BTC and ETH price action, exchange flows, and liquidation data",
  defi: "DeFi protocol TVL changes and notable yield opportunities",
  equities: "Major index movements and sector rotation signals",
  "on-chain": "Notable large wallet transactions and token unlock events",
  regulation: "Recent regulatory actions and policy developments affecting crypto",
  commodities: "Gold, oil, and DXY movements with key drivers",
  sentiment: "Market fear & greed, ETF inflows, and options positioning",
  "stellar-ecosystem": "Stellar protocol updates and ecosystem project milestones",
  "risk-events": "Systemic risk indicators and potential contagion signals",
};

async function main() {
  const secretKey = requireEnv("STELLAR_SECRET_KEY");
  const apiUrl = Bun.env.LUMENS_API_URL ?? "https://lumens.news";
  const beat = parseBeat(Bun.env.BEAT);
  const topic = Bun.env.TOPIC ?? defaultTopics[beat];
  const systemPrompt = Bun.env.SYSTEM_PROMPT;

  const signal = await runCorrespondent({ secretKey, apiUrl, beat, topic, systemPrompt });

  console.log("\n--- Filed Signal ---");
  console.log(JSON.stringify(signal, null, 2));
}

main().catch((err) => {
  console.error("[correspondent] fatal:", err.message);
  process.exit(1);
});
