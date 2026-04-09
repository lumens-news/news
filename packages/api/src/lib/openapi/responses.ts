import { z } from "@hono/zod-openapi";

export const internalServerErrorCode = "internal_server_error";
export const internalServerErrorMessage = "Unexpected error occured";

export const internalServerErrorSchema = z
  .object({
    error: z.literal(internalServerErrorCode),
    message: z.literal(internalServerErrorMessage),
  })
  .openapi("InternalServerError");
export type InternalServerError = z.infer<typeof internalServerErrorSchema>;
