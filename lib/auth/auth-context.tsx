"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authRepository } from "@/lib/data";
import type { User } from "@/lib/domain/user";

const CURRENT_USER_QUERY_KEY = ["auth", "current-user"] as const;

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: () => authRepository.getCurrentUser(),
    staleTime: Infinity,
  });

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      const user = await authRepository.signIn(email, password);
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
      return user;
    },
    [queryClient]
  );

  const signOut = React.useCallback(async () => {
    await authRepository.signOut();
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
  }, [queryClient]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user: currentUserQuery.data ?? null,
      isLoading: currentUserQuery.isLoading,
      signIn,
      signOut,
    }),
    [currentUserQuery.data, currentUserQuery.isLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
