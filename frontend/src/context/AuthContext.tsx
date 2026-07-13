import { createContext, useEffect, useMemo, useState } from 'react';
import { onAuthChange } from '../lib/authBus';
import { getStoredToken } from '../lib/apiClient';
import { getCurrentAppSession } from '../services/authService';
import { EmployerProfileRow, GuardProfileRow, ProfileRow } from '../lib/apiTypes';

type AuthContextValue = {
  profile: ProfileRow | null;
  employerProfile: EmployerProfileRow | null;
  guardProfile: GuardProfileRow | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [employerProfile, setEmployerProfile] = useState<EmployerProfileRow | null>(null);
  const [guardProfile, setGuardProfile] = useState<GuardProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!getStoredToken()) {
      setProfile(null);
      setEmployerProfile(null);
      setGuardProfile(null);
      return;
    }

    const session = await getCurrentAppSession();
    setProfile(session?.profile ?? null);
    setEmployerProfile(session?.employerProfile ?? null);
    setGuardProfile(session?.guardProfile ?? null);
  };

  useEffect(() => {
    let mounted = true;

    refreshProfile().finally(() => {
      if (mounted) setLoading(false);
    });

    const unsubscribe = onAuthChange(() => {
      refreshProfile().catch(() => {
        setProfile(null);
        setEmployerProfile(null);
        setGuardProfile(null);
      });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ profile, employerProfile, guardProfile, loading, refreshProfile }),
    [profile, employerProfile, guardProfile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
