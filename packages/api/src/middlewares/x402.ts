import type { Price } from "@x402/core/types";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware } from "@x402/hono";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { createMiddleware } from "hono/factory";

import type { Env } from "../config/env";

export type X402PaymentOption = {
  price: Price;
  description?: string;
  mimeType?: string;
};

export const x402Payment = ({ price, description, mimeType = "application/json" }: X402PaymentOption) =>
  createMiddleware<Env>(async (c, next) => {
    const facilitatorClient = new HTTPFacilitatorClient({
      url: c.env.X402_FACILITATOR_URL,
      createAuthHeaders: async () => {
        const headers = { Authorization: `Bearer ${c.env.X402_FACILITATOR_API_KEY}` };

        return { verify: headers, settle: headers, supported: headers };
      },
    });

    const server = new x402ResourceServer(facilitatorClient)
      // .register("stellar:mainnet", new ExactStellarScheme())
      .register("stellar:testnet", new ExactStellarScheme());

    return paymentMiddleware(
      {
        [`GET ${c.req.path}`]: {
          description,
          mimeType,
          accepts: [
            {
              scheme: "exact",
              network: "stellar:testnet",
              payTo: c.env.X402_PAY_TO,
              price,
            },
          ],
        },
      },
      server
    )(c, next);
  });
