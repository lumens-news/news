import { wrapFetchWithPayment, x402Client, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const NETWORK = "stellar:testnet"; // use pubnet for mainnet
const STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
const LUMENSNEWS_API_URL = Bun.env.LUMENSNEWS_API_URL ?? "http://localhost:8787";

const STELLAR_PRIVATE_KEY = Bun.env.STELLAR_PRIVATE_KEY!;

// ── helpers ──────────────────────────────────────────────────────────────────

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

// ── setup ─────────────────────────────────────────────────────────────────────

console.log(`Connecting to ${LUMENSNEWS_API_URL} on ${NETWORK}`);

const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, NETWORK);
const client = new x402Client().register("stellar:*", new ExactStellarScheme(signer, { url: STELLAR_RPC_URL }));
const httpClient = new x402HTTPClient(client);
const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient);

// ── step 1: list signals ──────────────────────────────────────────────────────

console.log("Fetching available signals...");

const listRes = await fetch(`${LUMENSNEWS_API_URL}/api/signals`);

console.log(`Server responded with ${listRes.status} ${listRes.statusText}`);

if (!listRes.ok) {
  const body = await listRes.text();
  console.log(`Failed to fetch signals: ${body}`);
  process.exit(1);
}

const signals = (await listRes.json()) as Array<{
  id: string;
  correspondent: string;
  beat: string;
  headline: string;
  tags: string[];
  publishedAt: string;
}>;

console.log(`Found ${signals.length} signal(s)`);

if (signals.length === 0) {
  console.log("\nNo published signals found.");
  process.exit(0);
}

// ── display list ──────────────────────────────────────────────────────────────

console.log(`\n┌─ Available Signals ${"─".repeat(60)}`);
for (let i = 0; i < signals.length; i++) {
  const s = signals[i]!;
  console.log(`│ [${i}] ${s.headline}`);
  console.log(`│   Beat: ${s.beat}  Published: ${s.publishedAt}`);
  if (i < signals.length - 1) console.log("│");
}
console.log(`└${"─".repeat(80)}`);

// ── step 2: prompt for selection ──────────────────────────────────────────────

const raw = await prompt(`\nEnter signal index (0–${signals.length - 1}): `);
const index = Number(raw);

if (!Number.isInteger(index) || index < 0 || index >= signals.length) {
  console.log(`"${raw}" is not a valid choice. Please enter a number between 0 and ${signals.length - 1}.`);
  process.exit(1);
}

const selectedSignal = signals[index]!;
console.log(`Selected: "${selectedSignal.headline}"`);

// ── step 3: fetch full signal (paid) ──────────────────────────────────────────

const signalUrl = `${LUMENSNEWS_API_URL}/api/signals/${selectedSignal.id}`;
console.log("Fetching full signal (payment will be processed automatically)...");

const res = await fetchWithPayment(signalUrl);

console.log(`Server responded with ${res.status} ${res.statusText}`);

if (!res.ok) {
  const body = await res.text();
  console.log(`Failed to fetch signal: ${body}`);
  process.exit(1);
}

const data = (await res.json()) as {
  id: string;
  correspondent: string;
  beat: string;
  headline: string;
  body: string;
  tags: string[];
  sources: Array<{ title: string; url: string }>;
  publishedAt: string;
};

console.log("Signal received:");

const divider = "─".repeat(80);
console.log(`\n┌${divider}`);
console.log(`│ ${data.headline}`);
console.log(`│ Beat: ${data.beat}  •  Published: ${new Date(data.publishedAt).toLocaleString()}`);
console.log(`│ Correspondent: ${data.correspondent}`);
if (data.tags.length > 0) console.log(`│ Tags: ${data.tags.join(", ")}`);
console.log(`├${divider}`);
console.log(`│`);
for (const line of data.body.split("\n")) console.log(`│ ${line}`);
console.log(`│`);
if (data.sources.length > 0) {
  console.log(`├${divider}`);
  console.log(`│ Sources:`);
  for (const src of data.sources) console.log(`│   • ${src.title} — ${src.url}`);
}
console.log(`└${divider}`);
