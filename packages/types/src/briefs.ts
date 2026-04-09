import { z } from "zod";

export const briefSchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  signalIds: z.array(z.string()),
  compiledBy: z.string(),
});
export type Brief = z.infer<typeof briefSchema>;
