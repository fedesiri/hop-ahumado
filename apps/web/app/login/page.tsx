"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "@/lib/auth-context";
import { getFirebaseAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) { setError("Ingresá tu email"); return; }
    if (!password) { setError("Ingresá tu contraseña"); return; }
    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      await refresh();
      router.replace(getFromPath());
    } catch (e: any) {
      setError(e?.message || "Error al iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      background: "var(--ha-bg, #0f1117)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "var(--ha-bg-card, #161b25)",
        border: "1px solid var(--ha-border, rgba(255,255,255,0.08))",
        borderRadius: 14,
        padding: 32,
      }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "var(--ha-amber, #f5a623)",
            display: "inline-grid", placeItems: "center",
            fontSize: 22, fontWeight: 700, color: "#0f1117",
            marginBottom: 14,
          }}>H</div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--ha-text, rgba(255,255,255,0.92))", letterSpacing: "-.02em" }}>
            Hop · Alumo
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ha-text-3, rgba(255,255,255,0.40))" }}>
            Acceso para usuarios autorizados
          </p>
        </div>

        {checkingSession ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              width: 24, height: 24, margin: "0 auto",
              borderRadius: "50%", border: "2px solid var(--ha-border-2)",
              borderTopColor: "var(--ha-amber)",
              animation: "ha-spin .7s linear infinite",
            }} />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="ha-formgrid" noValidate>
            <div className="ha-field">
              <label className="ha-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={`ha-input${error && !email ? " ha-input--error" : ""}`}
                placeholder="tu@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="ha-field">
              <label className="ha-label" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                className={`ha-input${error && !password ? " ha-input--error" : ""}`}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            {error && <p className="ha-error" style={{ margin: 0 }}>{error}</p>}

            <button
              type="submit"
              className="ha-btn ha-btn--primary ha-btn--lg"
              style={{ width: "100%", marginTop: 4 }}
              disabled={submitting}
            >
              {submitting ? (
                <span style={{
                  display: "inline-block", width: 18, height: 18,
                  borderRadius: "50%", border: "2px solid rgba(15,17,23,.3)",
                  borderTopColor: "#0f1117",
                  animation: "ha-spin .7s linear infinite",
                }} />
              ) : "Entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
