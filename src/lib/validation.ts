import { z } from 'zod';
import { MAX_STEPS_PER_DAY } from './constants';

const todayISO = () => new Date().toISOString().slice(0, 10);

export const stepSubmissionSchema = z.object({
  step_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
    .refine((d) => d <= todayISO(), 'Cannot submit steps for a future date'),
  steps: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Whole steps only')
    .min(0, 'Steps cannot be negative')
    .max(MAX_STEPS_PER_DAY, `Max ${MAX_STEPS_PER_DAY.toLocaleString()} steps/day`),
});
export type StepSubmissionInput = z.infer<typeof stepSubmissionSchema>;

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Too short').max(40, 'Too long'),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const eventSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    description: z.string().max(500).default(''),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    max_steps_per_day: z.coerce.number().int().min(1000).max(500000).default(MAX_STEPS_PER_DAY),
    goal_steps: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  });
export type EventInput = z.infer<typeof eventSchema>;
