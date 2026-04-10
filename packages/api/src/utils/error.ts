import type { InternalServerError } from "../lib/openapi/errors";
import {
  forbiddenErrorCode,
  forbiddenErrorDefaultMessage,
  internalServerErrorCode,
  internalServerErrorMessage,
  unauthorizedErrorCode,
  unauthorizedErrorDefaultMessage,
} from "../lib/openapi/errors";

export const buildError = <TError extends string, TMessage extends string>(error: TError, message: TMessage) => ({
  error,
  message,
});

export const unauthorizedError = <TMessage extends string>(message?: TMessage) => buildError(unauthorizedErrorCode, message ?? unauthorizedErrorDefaultMessage);
export const forbiddenError = <TMessage extends string>(message?: TMessage) => buildError(forbiddenErrorCode, message ?? forbiddenErrorDefaultMessage);
export const internalServerError = (): InternalServerError => buildError(internalServerErrorCode, internalServerErrorMessage);
