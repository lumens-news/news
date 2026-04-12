import { Keypair } from "@stellar/stellar-sdk";

export type VerifyStellarAuthParam = {
  address: string;
  message: string;
  signature: string;
  timestamp: number;
};

export function verifyStellarSignature({ address, message, signature, timestamp }: VerifyStellarAuthParam): boolean {
  // Check timestamp freshness (±5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return false;

  const keypair = Keypair.fromPublicKey(address);
  const valid = keypair.verify(Buffer.from(message), Buffer.from(signature, "base64"));

  return valid;
}
