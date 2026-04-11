import { createMiddleware } from "hono/factory";

import type { Env } from "../config/env";
import { buildError } from "../utils/error";

export const onlyEvaluatorErrorCode = "only_evaluator";
export const onlyEvaluatorErrorMessage = "Only evaluator";

export const isEvaluator = <TEvaluatorAddress extends string>(address?: TEvaluatorAddress) =>
  createMiddleware<Env>(async (c, next) => {
    if (c.env.EVALUATOR_AGENT_ADDRESS !== address) return c.json(buildError(onlyEvaluatorErrorCode, onlyEvaluatorErrorMessage), 403);

    return next();
  });
