import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import { getDefaultAcademicYear } from '../lib/dateUtils';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isConfigured: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_PREFERENCES = {
  default_academic_year: getDefaultAcademicYear(),
  default_semester: 'Semester Ganjil',
  default_city: 'Rejang Lebong',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadOrCreateProfile = useCallback(async (authUser: User | null) => {
    if (!authUser || !supabase) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!error && data) {
      setProfile({
        ...data,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...(data.preferences ?? {}),
        },
      } as Profile);
      return;
    }

    // If profile row doesn't exist yet (e.g., user registered before trigger was added), create it
    const fallbackName =
      (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
      authUser.email?.split('@')[0] ||
      'Guru GEC';

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authUser.id,
          full_name: fallbackName,
          email: authUser.email ?? null,
          phone: (authUser.user_metadata?.phone as string | undefined) ?? null,
          role: 'teacher',
          preferences: DEFAULT_PREFERENCES,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (!insertError && inserted) {
      setProfile(inserted as Profile);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadOrCreateProfile(user);
    }
  }, [user, loadOrCreateProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        await loadOrCreateProfile(data.session?.user ?? null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void loadOrCreateProfile(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadOrCreateProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isConfigured: isSupabaseConfigured,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
