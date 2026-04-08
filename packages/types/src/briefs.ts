import { z } from "zod";

export const briefSchema = z.object({
  id: z.string(),
  date: z.date(),
  compiledBy: z.string(),
  createdAt: z.date(),
});
export type Brief = z.infer<typeof briefSchema>;
