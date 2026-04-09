import type { InternalServerError } from "../lib/openapi/errors";
import { internalServerErrorCode, internalServerErrorMessage } from "../lib/openapi/errors";

export const internalServerError: InternalServerError = {
  error: internalServerErrorCode,
  message: internalServerErrorMessage,
};
