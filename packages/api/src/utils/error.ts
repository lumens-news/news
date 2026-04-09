import type { InternalServerError } from "../lib/openapi/responses";
import { internalServerErrorCode, internalServerErrorMessage } from "../lib/openapi/responses";

export const internalServerError: InternalServerError = {
  error: internalServerErrorCode,
  message: internalServerErrorMessage,
};
