"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "@/lib/auth-context";
import { getFirebaseAuth } from "@/lib/firebase";
import { TriangleAlert } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFromPath = () => {
    if (typeof window === "undefined") return "/";
    return new URLSearchParams(window.location.search).get("from") || "/";
  };

  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const res = await authFetch(`${API_URL}/auth/me`, { method: "GET" });
        if (mounted && res.ok) {
          router.replace(getFromPath());
          return;
        }
      } catch {
        // not authenticated
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }
    checkSession();
    return () => { mounted = false; };
  }, [router]);

  const onGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await refresh();
      router.replace(getFromPath());
    } catch {
      setError("No se pudo ingresar con Google.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lg-page">
      {/* Left brand panel — desktop only */}
      <div className="lg-left">
        <div className="lg-logo">Hop · Alumo</div>
        <div className="lg-tag">Sistema de gestión interna</div>
        <div className="lg-pills">
          <span className="lg-pill">🍺 Hop</span>
          <span className="lg-pill">🥩 Alumo</span>
        </div>
      </div>

      {/* Top brand — mobile only */}
      <div className="lg-brandtop">
        <div className="lg-logo">Hop · Alumo</div>
        <div className="lg-tag">Sistema de gestión interna</div>
      </div>

      {/* Form area */}
      <div className="lg-right">
        {checkingSession ? (
          <div style={{ display: "grid", placeItems: "center", padding: 48 }}>
            <span className="lg-spin" />
          </div>
        ) : (
          <div className="lg-card">
            <h1 className="lg-card__title">Iniciar sesión</h1>
            <p className="lg-card__sub">Ingresá con tu cuenta de Google.</p>

            {error && (
              <div className="lg-alert">
                <TriangleAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <button type="button" className="lg-btn" onClick={onGoogle} disabled={submitting}>
              Entrar con Google
            </button>

          </div>
        )}
      </div>
    </div>
  );
}
