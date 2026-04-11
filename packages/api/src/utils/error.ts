import type { InternalServerError } from "../lib/openapi/errors";
import { internalServerErrorCode, internalServerErrorMessage } from "../lib/openapi/errors";

export const buildError = <TError extends string, TMessage extends string>(error: TError, message: TMessage) => ({
  error,
  message,
});

export const internalServerError = (): InternalServerError => buildError(internalServerErrorCode, internalServerErrorMessage);
