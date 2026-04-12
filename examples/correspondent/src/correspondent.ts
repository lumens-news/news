import { Keypair } from "@stellar/stellar-sdk";
import { generateText, Output } from "ai";

import type { CorrespondentConfig, Signal } from "./types";
import { signRequest } from "./auth";
import { getSystemPrompt } from "./prompts";
import { signalSchema } from "./types";

/**
 * Generate a financial intelligence signal using the Vercel AI SDK.
 *
 * The gateway is configured automatically via the AI_GATEWAY_API_KEY env var.
 * The model is specified as a provider-prefixed string, e.g. "openai/gpt-4o".
 */
async function generateSignal(config: CorrespondentConfig): Promise<Signal> {
  const model = Bun.env.AI_MODEL ?? "openai/gpt-4o";
  const systemPrompt = getSystemPrompt(config.beat, config.systemPrompt);

  const { output } = await generateText({
    model,
    output: Output.object({ schema: signalSchema }),
    system: systemPrompt,
    prompt: `Research and file a signal for the following topic on the "${config.beat}" beat:

${config.topic}

Requirements:
- Headline: sharp, specific, fact-first (max 300 chars)
- Body: analytical, data-driven, 2–4 short paragraphs (max 2048 chars)
- Tags: 3–8 relevant lowercase tags
- Sources: 1–5 credible, real URLs (no placeholder links)

File a high-quality signal now.`,
  });

  return output;
}

/**
 * File a generated signal to the lumens.news API.
 */
async function fileSignal(config: CorrespondentConfig, signal: Signal): Promise<void> {
  const path = "/api/signals";
  const authHeaders = signRequest(config.secretKey, "POST", path);

  const body = JSON.stringify({
    beat: config.beat,
    headline: signal.headline,
    body: signal.body,
    tags: signal.tags,
    sources: signal.sources,
  });

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to file signal (${response.status}): ${text}`);
  }
}

/**
 * Run the correspondent agent:
 * 1. Generate a quality signal with AI (Vercel AI Gateway)
 * 2. Sign the request with the Stellar keypair
 * 3. File it to lumens.news
 *
 * Returns the generated signal for inspection.
 */
export async function runCorrespondent(config: CorrespondentConfig): Promise<Signal> {
  const address = Keypair.fromSecret(config.secretKey).publicKey();
  console.log(`[correspondent] address=${address}  beat=${config.beat}`);
  console.log(`[correspondent] topic="${config.topic}"`);

  console.log("[correspondent] generating signal...");
  const signal = await generateSignal(config);

  console.log(`[correspondent] headline="${signal.headline}"`);
  console.log(`[correspondent] tags=${signal.tags.join(", ")}`);
  console.log(`[correspondent] sources=${signal.sources.length}`);

  console.log("[correspondent] filing signal...");
  await fileSignal(config, signal);

  console.log("[correspondent] signal filed successfully");
  return signal;
}
