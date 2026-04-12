import { Keypair } from "@stellar/stellar-sdk";

export type StellarAuthHeaders = {
  "x-stellar-address": string;
  "x-stellar-signature": string;
  "x-stellar-timestamp": string;
};

/**
 * Sign a lumens.news API request using a Stellar Ed25519 keypair.
 *
 * Message format: "METHOD /path:unix_timestamp"
 * Example:        "POST /api/signals:1712534400"
 */
export function signRequest(secretKey: string, method: string, path: string): StellarAuthHeaders {
  const keypair = Keypair.fromSecret(secretKey);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${method} ${path}:${timestamp}`;

  const signature = keypair.sign(Buffer.from(message)).toString("base64");

  return {
    "x-stellar-address": keypair.publicKey(),
    "x-stellar-signature": signature,
    "x-stellar-timestamp": timestamp,
  };
}
