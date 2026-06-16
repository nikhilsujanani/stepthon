import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Users, Layers, Activity, Footprints, Trophy, Star, Plus, Pencil, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/common/StatCard';
import { adminService } from '@/services/admin.service';
import { eventService } from '@/services/event.service';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { useAuth } from '@/hooks/useAuth';
import { eventSchema, type EventInput } from '@/lib/validation';
import { MAX_STEPS_PER_DAY, qk } from '@/lib/constants';
import { fmtCompact, fmtSteps } from '@/lib/format';
import type { Event } from '@/types';

// ── helpers ────────────────────────────────────────────────────────────────

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('events_one_active_idx'))
    return 'Another event is already active — close it first.';
  return msg;
}

function toEventInput(ev: Event): EventInput {
  return {
    name: ev.name,
    description: ev.description,
    start_date: ev.start_date,
    end_date: ev.end_date,
    max_steps_per_day: ev.max_steps_per_day,
    goal_steps: ev.goal_steps ?? undefined,
  };
}

// ── status badge ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Event['status'], string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
};

function EventStatusBadge({ status }: { status: Event['status'] }) {
  return (
    <Badge variant={status}>
      {status === 'active' && (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
      )}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

// ── event form ─────────────────────────────────────────────────────────────

interface EventFormProps {
  defaultValues?: EventInput;
  isEditing: boolean;
  onSubmit: (data: EventInput) => void;
  isPending: boolean;
  error: string | null;
}

function EventForm({ defaultValues, isEditing, onSubmit, isPending, error }: EventFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventInput>({
    resolver: zodResolver(eventSchema),
    defaultValues: defaultValues ?? {
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      max_steps_per_day: MAX_STEPS_PER_DAY,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ef-name">Event Name *</Label>
        <Input id="ef-name" {...register('name')} placeholder="Stepathon 2026" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ef-desc">Description</Label>
        <Textarea
          id="ef-desc"
          rows={2}
          placeholder="Optional tagline or notes…"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ef-start">Start Date *</Label>
          <Input id="ef-start" type="date" {...register('start_date')} />
          {errors.start_date && (
            <p className="text-xs text-destructive">{errors.start_date.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ef-end">End Date *</Label>
          <Input id="ef-end" type="date" {...register('end_date')} />
          {errors.end_date && (
            <p className="text-xs text-destructive">{errors.end_date.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ef-cap">Daily Step Cap</Label>
        <Input
          id="ef-cap"
          type="number"
          inputMode="numeric"
          {...register('max_steps_per_day')}
        />
        {errors.max_steps_per_day && (
          <p className="text-xs text-destructive">{errors.max_steps_per_day.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ef-goal">
          Step Goal{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="ef-goal"
          type="number"
          inputMode="numeric"
          placeholder="e.g. 10000000"
          {...register('goal_steps', {
            setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
          })}
        />
        {errors.goal_steps && (
          <p className="text-xs text-destructive">{errors.goal_steps.message}</p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Event'}
      </Button>
    </form>
  );
}

// ── events tab ─────────────────────────────────────────────────────────────

function EventsTab() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [confirming, setConfirming] = useState<{
    event: Event;
    action: 'activate' | 'close';
  } | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: qk.events,
    queryFn: () => eventService.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.events });
    queryClient.invalidateQueries({ queryKey: qk.activeEvent });
  };

  const createMutation = useMutation({
    mutationFn: (input: EventInput) => eventService.create(input, session!.user.id),
    onSuccess: () => { invalidate(); setFormOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<EventInput> }) =>
      eventService.update(id, patch),
    onSuccess: () => { invalidate(); setFormOpen(false); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Event['status'] }) =>
      eventService.setStatus(id, status),
    onSuccess: () => { invalidate(); setConfirming(null); },
  });

  const openEdit = (ev: Event) => {
    setEditing(ev);
    setFormOpen(true);
  };

  const closeForm = (open: boolean) => {
    if (!open) {
      setFormOpen(false);
      setTimeout(() => setEditing(null), 200);
    }
  };

  const formError =
    createMutation.error ? friendlyError(createMutation.error) :
    updateMutation.error ? friendlyError(updateMutation.error) : null;

  return (
    <div className="space-y-3">
      {/* header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Event
        </Button>
      </div>

      {/* loading state */}
      {isLoading && (
        <div className="grid h-24 place-items-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* empty state */}
      {!isLoading && events.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No events yet. Create your first event to get started.
          </CardContent>
        </Card>
      )}

      {/* event cards */}
      {events.map((ev) => (
        <Card key={ev.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{ev.name}</p>
                  <EventStatusBadge status={ev.status} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ev.start_date} → {ev.end_date}
                </p>
                {ev.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {ev.description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-1.5">
                {ev.status === 'draft' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setConfirming({ event: ev, action: 'activate' })}
                    >
                      <Play className="h-3.5 w-3.5" /> Activate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(ev)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </>
                )}
                {ev.status === 'active' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openEdit(ev)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirming({ event: ev, action: 'close' })}
                    >
                      <X className="h-3.5 w-3.5" /> Close
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* ── create / edit dialog ── */}
      <Dialog open={formOpen} onOpenChange={closeForm}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit · ${editing.name}` : 'Create Event'}
            </DialogTitle>
            {!editing && (
              <DialogDescription>
                New events start as <strong>draft</strong> — activate when ready to go live.
              </DialogDescription>
            )}
          </DialogHeader>
          <EventForm
            key={editing?.id ?? 'new'}
            defaultValues={editing ? toEventInput(editing) : undefined}
            isEditing={!!editing}
            onSubmit={(data) => {
              if (editing) {
                updateMutation.mutate({ id: editing.id, patch: data });
              } else {
                createMutation.mutate(data);
              }
            }}
            isPending={createMutation.isPending || updateMutation.isPending}
            error={formError}
          />
        </DialogContent>
      </Dialog>

      {/* ── activate / close confirm dialog ── */}
      <Dialog open={!!confirming} onOpenChange={(open) => { if (!open) setConfirming(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirming?.action === 'activate' ? 'Activate Event?' : 'Close Event?'}
            </DialogTitle>
            <DialogDescription>
              {confirming?.action === 'activate'
                ? `"${confirming.event.name}" will go live and participants can start logging steps.`
                : `Close "${confirming?.event.name}"? Step submissions will be disabled and this cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          {statusMutation.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {friendlyError(statusMutation.error)}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant={confirming?.action === 'close' ? 'destructive' : 'default'}
              disabled={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  id: confirming!.event.id,
                  status: confirming!.action === 'activate' ? 'active' : 'closed',
                })
              }
            >
              {statusMutation.isPending
                ? 'Saving…'
                : confirming?.action === 'activate'
                ? 'Activate'
                : 'Close Event'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── stats tab ──────────────────────────────────────────────────────────────

function StatsTab() {
  const { data: event } = useActiveEvent();

  const { data: stats } = useQuery({
    queryKey: event ? qk.adminStats(event.id) : ['admin', 'none'],
    enabled: !!event,
    queryFn: () => adminService.stats(event!.id),
  });

  const { data: trend = [] } = useQuery({
    queryKey: event ? ['admin', 'trend', event.id] : ['trend', 'none'],
    enabled: !!event,
    queryFn: () => adminService.dailyTrend(event!.id),
  });

  if (!event) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No active event — activate one in the Events tab.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">{event.name}</p>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Participants" value={stats?.totalParticipants ?? 0} icon={Users} />
        <StatCard label="Teams" value={stats?.totalTeams ?? 0} icon={Layers} />
        <StatCard
          label="Participation"
          value={`${stats?.participationRate ?? 0}%`}
          icon={Activity}
          hint="logged today"
        />
        <StatCard
          label="Today's Steps"
          value={fmtCompact(stats?.todaysSteps)}
          icon={Footprints}
        />
        <StatCard
          label="Top Team"
          value={stats?.topTeam?.name ?? '—'}
          icon={Trophy}
          hint={stats?.topTeam ? fmtSteps(stats.topTeam.steps) : ''}
        />
        <StatCard
          label="Most Active"
          value={stats?.mostActiveUser?.name?.split(' ')[0] ?? '—'}
          icon={Star}
          hint={stats?.mostActiveUser ? fmtSteps(stats.mostActiveUser.steps) : ''}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 font-semibold">Daily Step Trend</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
              <Tooltip formatter={(v: number) => fmtSteps(v)} />
              <Line
                type="monotone"
                dataKey="steps"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 font-semibold">Daily Participation</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="participants"
                fill="hsl(var(--secondary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export function AdminPage() {
  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Admin</h1>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4">
          <EventsTab />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <StatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
