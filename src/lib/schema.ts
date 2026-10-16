import { z } from "zod";

export const hintResponseSchema = z.object({
  level: z.number().int().min(0).max(5),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  conceptsToReview: z.array(z.string().trim().min(1).max(80)).max(12),
});

export type HintResponse = z.infer<typeof hintResponseSchema>;

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type LadderLevel = (typeof LEVELS)[number];

export const LEVEL_TITLES: Record<LadderLevel, string> = {
  1: "Category",
  2: "Key insight",
  3: "Approach",
  4: "Pseudocode",
  5: "Full solution",
};
