import { z } from "@hono/zod-openapi";

export const buildErrorSchema = <TError extends string>(errorCode: TError) =>
  z.object({
    error: z.literal(errorCode),
    message: z.string(),
  });
export type Error = z.infer<ReturnType<typeof buildErrorSchema>>;

export const buildNotFoundErrorSchema = <TResource extends string>(resource: TResource) =>
  z.object({
    error: z.templateLiteral([z.literal(resource), z.literal("_not_found")]),
    message: z.string(),
  });
export type NotFoundError = z.infer<ReturnType<typeof buildNotFoundErrorSchema>>;

export const internalServerErrorCode = "internal_server_error";
export const internalServerErrorMessage = "Unexpected error occurred";

export const internalServerErrorSchema = z
  .object({
    error: z.literal(internalServerErrorCode),
    message: z.literal(internalServerErrorMessage),
  })
  .openapi("InternalServerError");
export type InternalServerError = z.infer<typeof internalServerErrorSchema>;
