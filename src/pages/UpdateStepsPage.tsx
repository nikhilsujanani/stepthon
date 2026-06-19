import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Camera, ImageIcon, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EventParticipationGate } from '@/components/common/EventParticipationGate';
import { stepSubmissionSchema, type StepSubmissionInput } from '@/lib/validation';
import { useSubmitSteps } from '@/hooks/useSteps';
import { useConfetti } from '@/hooks/useConfetti';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { MAX_STEPS_PER_DAY } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function UpdateStepsPage() {
  const navigate = useNavigate();
  const { data: event } = useActiveEvent();
  const fire = useConfetti();
  const submit = useSubmitSteps();
  const today = new Date().toISOString().slice(0, 10);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<StepSubmissionInput>({
    resolver: zodResolver(stepSubmissionSchema),
    defaultValues: { step_date: today, steps: 0 },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofError(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearProof = (e: React.MouseEvent) => {
    e.preventDefault();
    setProofFile(null);
    setPreview(null);
  };

  const onSubmit = handleSubmit((values) => {
    if (!proofFile) {
      setProofError('Please upload a screenshot or photo as proof.');
      return;
    }
    submit.mutate(
      { stepDate: values.step_date, steps: Number(values.steps), proofFile },
      {
        onSuccess: () => {
          fire();
          setTimeout(() => navigate('/'), 900);
        },
      },
    );
  });

  if (!event) {
    return <p className="py-10 text-center text-muted-foreground">No active event.</p>;
  }

  return (
    <EventParticipationGate eventId={event.id}>
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
                <p className="mb-1.5 text-sm font-medium">
                  Proof Screenshot <span className="text-destructive">*</span>
                </p>
                <label
                  htmlFor="proof-upload"
                  className={cn(
                    'relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
                    preview
                      ? 'border-primary/40 p-1'
                      : 'border-border hover:border-primary/50 hover:bg-muted/20',
                    proofError && !preview && 'border-destructive/60',
                  )}
                >
                  {preview ? (
                    <>
                      <img
                        src={preview}
                        alt="Step proof"
                        className="max-h-52 w-full rounded-lg object-contain"
                      />
                      <button
                        onClick={clearProof}
                        className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        aria-label="Remove photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 p-6">
                      <p className="text-sm font-medium text-muted-foreground">
                        Show your step count as proof
                      </p>
                      <div className="flex gap-3">
                        <label
                          htmlFor="proof-camera"
                          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-5 py-3 text-sm font-medium hover:bg-muted/60 transition-colors"
                        >
                          <Camera className="h-6 w-6 text-primary" />
                          Take Photo
                          <input
                            id="proof-camera"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="sr-only"
                            onChange={handleFileChange}
                          />
                        </label>
                        <label
                          htmlFor="proof-upload"
                          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-5 py-3 text-sm font-medium hover:bg-muted/60 transition-colors"
                        >
                          <ImageIcon className="h-6 w-6 text-primary" />
                          Screenshot
                          <input
                            id="proof-upload"
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                      <p className="text-[11px] text-muted-foreground text-center">
                        Google Fit, Apple Health, Fitbit, watch…
                      </p>
                    </div>
                  )}
                </label>
                {proofError && (
                  <p className="mt-1 text-xs text-destructive">{proofError}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="step_date">Date</label>
                <input
                  id="step_date" type="date" max={today}
                  className="h-11 w-full rounded-lg border bg-background px-3"
                  {...register('step_date')}
                />
                {errors.step_date && (
                  <p className="mt-1 text-xs text-destructive">{errors.step_date.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="steps">Steps</label>
                <input
                  id="steps" type="number" inputMode="numeric" placeholder="e.g. 8500"
                  className="h-16 w-full rounded-lg border bg-background px-3 text-center text-3xl font-bold tabular-nums"
                  {...register('steps')}
                />
                {errors.steps && (
                  <p className="mt-1 text-xs text-destructive">{errors.steps.message}</p>
                )}
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
    </EventParticipationGate>
  );
}
