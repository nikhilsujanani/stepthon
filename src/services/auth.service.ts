import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';

export const authService = {
  /** Kick off Google OAuth (PKCE). Returns to `redirectTo` after consent. */
  signInWithGoogle(redirectTo = window.location.origin) {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } },
    });
  },

  signOut() {
    return supabase.auth.signOut();
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /** The public.users profile row (auto-provisioned by the auth trigger). */
  async getProfile(): Promise<UserProfile | null> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await supabase
      .from('users').select('*').eq('id', auth.user.id).single();
    if (error) throw error;
    return data;
  },

  onAuthStateChange(cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
    return supabase.auth.onAuthStateChange(cb);
  },
};
