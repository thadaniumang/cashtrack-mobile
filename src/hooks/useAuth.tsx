import { useEffect, useState } from 'react';
import { supabase, hasSupabaseEnv } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: Error }>;
  signUp: (email: string, password: string) => Promise<{ error?: Error }>;
  resetPassword: (email: string) => Promise<{ error?: Error }>;
  updatePassword: (password: string) => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
  clearPasswordRecovery: () => void;
}

export function useAuth(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      if (!hasSupabaseEnv) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data?.session) {
          if (isMounted) setUser(data.session.user);
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted) {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          setUser(session?.user ?? null);
          setIsPasswordRecovery(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsPasswordRecovery(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : undefined };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error ? new Error(error.message) : undefined };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign up failed') };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error ? new Error(error.message) : undefined };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Password reset failed') };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error ? new Error(error.message) : undefined };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Password update failed') };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      throw err;
    }
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  return {
    user,
    isLoading,
    isPasswordRecovery,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    clearPasswordRecovery,
  };
}
