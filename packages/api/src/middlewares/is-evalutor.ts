import { createMiddleware } from "hono/factory";

import type { Env } from "../config/env";
import { forbiddenError } from "../utils/error";

export const isEvaluator = <TEvaluatorAddress extends string>(address?: TEvaluatorAddress) =>
  createMiddleware<Env>(async (c, next) => {
    if (c.env.EVALUATOR_AGENT_ADDRESS !== address) return c.json(forbiddenError(), 403);

    return next();
  });
