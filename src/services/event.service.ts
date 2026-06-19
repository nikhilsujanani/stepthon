import { supabase } from '@/lib/supabase';
import type { Event } from '@/types';
import type { EventInput } from '@/lib/validation';

const EVENT_COLUMNS =
  'id, name, description, start_date, end_date, status, max_steps_per_day, goal_steps, join_code, created_by, created_at, updated_at' as const;

function toEventPayload(input: Partial<EventInput>): Partial<Event> & { join_code?: string | null } {
  const { event_password: _password, join_code, ...rest } = input;
  const payload = { ...rest } as Partial<Event> & { join_code?: string | null };
  if (join_code !== undefined) {
    payload.join_code = join_code || null;
  }
  return payload;
}

export const eventService = {
  async getActive(): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events').select(EVENT_COLUMNS).eq('status', 'active').maybeSingle();
    if (error) throw error;
    return data;
  },

  async list(): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events').select(EVENT_COLUMNS).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async requiresAccess(eventId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('event_requires_access', { p_event_id: eventId });
    if (error) throw error;
    return !!data;
  },

  async hasAccess(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('event_access')
      .select('event_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async verifyAccess(joinCode: string, password: string): Promise<void> {
    const { error } = await supabase.rpc('verify_event_access', {
      p_join_code: joinCode,
      p_password: password,
    });
    if (error) throw error;
  },

  // ---- admin ----
  async create(input: EventInput, createdBy: string): Promise<Event> {
    const { event_password, ...payload } = input;
    const { data, error } = await supabase
      .from('events')
      .insert({ ...toEventPayload(payload), created_by: createdBy })
      .select(EVENT_COLUMNS)
      .single();
    if (error) throw error;

    if (event_password) {
      await eventService.setPassword(data.id, event_password);
    }

    return data;
  },

  async update(id: string, patch: Partial<EventInput>): Promise<Event> {
    const { event_password, ...payload } = patch;
    const dbPatch = toEventPayload(payload);

    let data: Event;
    if (Object.keys(dbPatch).length > 0) {
      const { data: updated, error } = await supabase
        .from('events')
        .update(dbPatch)
        .eq('id', id)
        .select(EVENT_COLUMNS)
        .single();
      if (error) throw error;
      data = updated;
    } else {
      const { data: existing, error } = await supabase
        .from('events')
        .select(EVENT_COLUMNS)
        .eq('id', id)
        .single();
      if (error) throw error;
      data = existing;
    }

    if (event_password) {
      await eventService.setPassword(id, event_password);
    }

    return data;
  },

  async setPassword(eventId: string, password: string): Promise<void> {
    const { error } = await supabase.rpc('set_event_password', {
      p_event_id: eventId,
      p_password: password,
    });
    if (error) throw error;
  },

  /** Activate. The partial unique index rejects a second active event. */
  async setStatus(id: string, status: Event['status']): Promise<Event> {
    const { data, error } = await supabase
      .from('events').update({ status }).eq('id', id).select(EVENT_COLUMNS).single();
    if (error) throw error;
    return data;
  },
};
