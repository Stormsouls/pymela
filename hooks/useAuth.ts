"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-client";

export type AuthState = {
  user: User | null;
  isAnon: boolean;
  isLoading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const db = getSupabaseBrowser();

    // Obtener sesión actual
    db.auth.getSession().then(({ data }: { data: { session: { user: User } | null } }) => {
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    // Escuchar cambios
    const { data: { subscription } } = db.auth.onAuthStateChange((_event: unknown, session: { user: User } | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInAnonymously() {
    const db = getSupabaseBrowser();
    const { data } = await db.auth.signInAnonymously();
    if (data.user) setUser(data.user);
  }

  // Auto sign-in anónimo si no hay sesión
  useEffect(() => {
    if (!isLoading && !user) {
      signInAnonymously();
    }
  }, [isLoading, user]);

  async function signInWithEmail(email: string): Promise<{ error: string | null }> {
    const db = getSupabaseBrowser();
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    const db = getSupabaseBrowser();
    await db.auth.signOut();
  }

  const isAnon = user?.is_anonymous === true;

  return { user, isAnon, isLoading, signInWithEmail, signOut };
}
