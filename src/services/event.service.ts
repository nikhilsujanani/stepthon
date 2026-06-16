import { supabase } from '@/lib/supabase';
import type { Event } from '@/types';
import type { EventInput } from '@/lib/validation';

export const eventService = {
  async getActive(): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events').select('*').eq('status', 'active').maybeSingle();
    if (error) throw error;
    return data;
  },

  async list(): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ---- admin ----
  async create(input: EventInput, createdBy: string): Promise<Event> {
    const { data, error } = await supabase
      .from('events').insert({ ...input, created_by: createdBy }).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<EventInput>): Promise<Event> {
    const { data, error } = await supabase
      .from('events').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /** Activate. The partial unique index rejects a second active event. */
  async setStatus(id: string, status: Event['status']): Promise<Event> {
    const { data, error } = await supabase
      .from('events').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};
