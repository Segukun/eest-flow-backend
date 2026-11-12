
import { z } from "zod";

export const resolveSectorJoinRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});
