import { z } from "@hono/zod-openapi";

export const resolveNotFoundErrorSchema = <TResource extends string>(resource: TResource) =>
  z.object({
    error: z.templateLiteral([z.literal(resource), z.literal("_not_found")]),
    message: z.string(),
  });
export type NotFoundError = z.infer<ReturnType<typeof resolveNotFoundErrorSchema>>;

export const internalServerErrorCode = "internal_server_error";
export const internalServerErrorMessage = "Unexpected error occured";

export const internalServerErrorSchema = z
  .object({
    error: z.literal(internalServerErrorCode),
    message: z.literal(internalServerErrorMessage),
  })
  .openapi("InternalServerError");
export type InternalServerError = z.infer<typeof internalServerErrorSchema>;
