"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;
  if (pathname === "/login") return true;
  if (pathname.startsWith("/login/")) return true;
  return false;
}

/**
 * Con API y web en hosts distintos (p. ej. dos *.run.app), la cookie de sesión no llega al servidor del front.
 * El middleware no puede validar sesión; este componente usa /auth/me vía fetch + credentials (misma cookie en el cliente).
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (isPublic || loading) return;
    if (!user) {
      const from = pathname && pathname !== "/" ? pathname : "/";
      router.replace(`/login?from=${encodeURIComponent(from)}`);
    }
  }, [isPublic, loading, user, pathname, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ha-bg)" }}>
        <div className="ha-spin-el" />
      </div>
    );
  }

  return <>{children}</>;
}
