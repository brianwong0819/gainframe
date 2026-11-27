import { z } from 'zod'

// One labelled meal of the eval set (ROADMAP M3-09): the photo's file name in
// the data folder, the true protein and energy from a package label or weighed
// ingredients, and the food table entries of its foods, which the no-AI
// baseline counts at one default serving each. `description` is the same meal
// in one sentence for the text estimate (M3-10). `split` keeps about a third
// of the cases out of prompt writing; the headline figures come from `test`.
export const evalCaseSchema = z.object({
  id: z.string().min(1),
  split: z.enum(['dev', 'test']),
  photo: z.string().regex(/\.(jpe?g|png|webp)$/i),
  description: z.string().min(1).max(300).optional(),
  locale: z.enum(['zh', 'en']).default('en'),
  proteinG: z.number().min(0),
  kcal: z.number().positive(),
  entryIds: z.array(z.string().min(1)).min(1),
})

// `labels.json` in the data folder. Photos and labels stay on the owner's
// computer, never in the repository (docs/ai.md, "Evals").
export const evalLabelsSchema = z
  .object({ cases: z.array(evalCaseSchema).min(1) })
  .refine(
    ({ cases }) => new Set(cases.map((item) => item.id)).size === cases.length,
    'Case ids must be unique',
  )

export type EvalCase = z.infer<typeof evalCaseSchema>
