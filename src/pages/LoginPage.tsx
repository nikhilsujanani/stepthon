import { Navigate } from 'react-router-dom';
import { Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { APP_NAME, TAGLINE } from '@/lib/constants';

export function LoginPage() {
  const { session, loading, signInWithGoogle } = useAuth();
  if (!loading && session) return <Navigate to="/" replace />;

  return (
    <div className="app-shell grid min-h-dvh place-items-center bg-gradient-to-b from-background to-primary/10 px-6">
      <div className="w-full">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-primary shadow-xl shadow-primary/30">
            <Footprints className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-muted-foreground">{TAGLINE}</p>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-center text-sm text-muted-foreground">
              Sign in to join your team and start logging steps.
            </p>
            <Button size="lg" className="w-full" onClick={signInWithGoogle}>
              <GoogleIcon /> Continue with Google
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              We only use your Google profile to identify you on the leaderboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 5.1 29.4 3 24 3 11.8 3 2 12.8 2 25s9.8 22 22 22 22-9.8 22-22c0-1.5-.2-2.9-.4-4.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 5.1 29.4 3 24 3 16 3 9.1 7.6 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 47c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 37.5 26.7 38 24 38c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9 42.3 15.9 47 24 47z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6.3 5.2C41.6 35.9 46 30.9 46 25c0-1.5-.2-2.9-.4-4.5z" />
    </svg>
  );
}
