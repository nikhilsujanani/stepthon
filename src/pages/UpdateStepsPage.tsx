import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { stepSubmissionSchema, type StepSubmissionInput } from '@/lib/validation';
import { useSubmitSteps } from '@/hooks/useSteps';
import { useConfetti } from '@/hooks/useConfetti';
import { MAX_STEPS_PER_DAY } from '@/lib/constants';

export function UpdateStepsPage() {
  const navigate = useNavigate();
  const fire = useConfetti();
  const submit = useSubmitSteps();
  const today = new Date().toISOString().slice(0, 10);

  const { register, handleSubmit, formState: { errors } } = useForm<StepSubmissionInput>({
    resolver: zodResolver(stepSubmissionSchema),
    defaultValues: { step_date: today, steps: 0 },
  });

  const onSubmit = handleSubmit((values) => {
    submit.mutate(
      { stepDate: values.step_date, steps: Number(values.steps) },
      {
        onSuccess: () => {
          fire();
          setTimeout(() => navigate('/'), 900);
        },
      },
    );
  });

  return (
    <div className="space-y-4 py-2">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Update Steps</h1>
      </header>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="step_date">Date</label>
              <input
                id="step_date" type="date" max={today}
                className="h-11 w-full rounded-lg border bg-background px-3"
                {...register('step_date')}
              />
              {errors.step_date && <p className="mt-1 text-xs text-destructive">{errors.step_date.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="steps">Steps</label>
              <input
                id="steps" type="number" inputMode="numeric" placeholder="e.g. 8500"
                className="h-16 w-full rounded-lg border bg-background px-3 text-center text-3xl font-bold tabular-nums"
                {...register('steps')}
              />
              {errors.steps && <p className="mt-1 text-xs text-destructive">{errors.steps.message}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Max {MAX_STEPS_PER_DAY.toLocaleString()} steps/day.
              </p>
            </div>

            {submit.isError && (
              <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                {(submit.error as Error).message}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Steps'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
