import { createMiddleware } from "hono/factory";

import type { Env } from "../config/env";
import { buildError } from "../utils/error";

export const onlyEvaluatorErrorCode = "only_evaluator";
export const onlyEvaluatorErrorMessage = "Only evaluator";

export type EvaluatorVariables = {
  Variables: {
    isEvaluator: boolean;
  };
};

export type IsEvaluatorOption = {
  passthrough: boolean;
};

export const isEvaluator = <TEvaluatorAddress extends string>(address?: TEvaluatorAddress, options?: IsEvaluatorOption) =>
  createMiddleware<Env & EvaluatorVariables>(async (c, next) => {
    const { passthrough = false } = options ?? {};

    if (passthrough) {
      c.set("isEvaluator", c.env.EVALUATOR_AGENT_ADDRESS === address);

      return next();
    }

    if (c.env.EVALUATOR_AGENT_ADDRESS !== address) {
      c.set("isEvaluator", false);

      return c.json(buildError(onlyEvaluatorErrorCode, onlyEvaluatorErrorMessage), 403);
    }

    c.set("isEvaluator", true);
    return next();
  });
