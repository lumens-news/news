import { createMiddleware } from "hono/factory";

import type { Env } from "../config/env";
import { verifyStellarSignature } from "../lib/stellar/auth";
import { buildError } from "../utils/error";

export const invalidAuthSignatureErrorCode = "invalid_auth_signature";
export const invalidAuthSignatureErrorMessage = "Invalid authentication signature provided";

export type StellarAuthVariables = {
  Variables: {
    stellarAddress: string;
  };
};

export type StellarAuthParam = {
  address: string;
  signature: string;
  timestamp: string;
};

export const stellarAuth = ({ address, signature, timestamp }: StellarAuthParam) =>
  createMiddleware<Env & StellarAuthVariables>(async (c, next) => {
    const message = `${c.req.method} ${c.req.path}:${timestamp}`;

    const validSignature = verifyStellarSignature({
      address,
      message,
      signature,
      timestamp: parseInt(timestamp, 10),
    });
    if (!validSignature) return c.json(buildError(invalidAuthSignatureErrorCode, invalidAuthSignatureErrorMessage), 401);

    c.set("stellarAddress", address);
    return next();
  });
