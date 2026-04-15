"use client";

import { authFetch } from "@/lib/auth-fetch";
import { getFirebaseAuth, waitForFirebaseAuthReady } from "@/lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  firebaseUid?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await waitForFirebaseAuthReady();

      const res = await authFetch(`${API_URL}/auth/me`, {
        method: "GET",
      });

      if (!res.ok) {
        setUser(null);
        return;
      }

      const data = (await res.json()) as {
        ok: boolean;
        user: { id: string; email: string; name: string };
        firebase?: { uid?: string };
      };

      setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        firebaseUid: data.firebase?.uid,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth()).catch(() => undefined);

    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      logout,
    }),
    [user, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
