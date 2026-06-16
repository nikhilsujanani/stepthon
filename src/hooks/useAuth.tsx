import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authService } from '@/services/auth.service';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function hydrateProfile(s: Session | null) {
      if (!s) { setProfile(null); return; }
      const { data } = await supabase.from('users').select('*').eq('id', s.user.id).single();
      if (active) setProfile(data ?? null);
    }

    authService.getSession().then(async (s) => {
      if (!active) return;
      setSession(s);
      await hydrateProfile(s);
      setLoading(false);
    });

    const { data: sub } = authService.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await hydrateProfile(s);
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signInWithGoogle: () => authService.signInWithGoogle(),
    signOut: async () => { await authService.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
