"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "@/lib/auth-context";
import { getFirebaseAuth } from "@/lib/firebase";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
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
  const [showPass, setShowPass] = useState(false);
  const [emailErr, setEmailErr] = useState(false);
  const [passErr, setPassErr] = useState(false);

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
    setEmailErr(false);
    setPassErr(false);
    if (!email) { setEmailErr(true); return; }
    if (!password) { setPassErr(true); return; }
    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      await refresh();
      router.replace(getFromPath());
    } catch {
      setError("Correo o contraseña incorrectos.");
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
            <p className="lg-card__sub">Ingresá con tu cuenta de empresa.</p>

            {error && (
              <div className="lg-alert">
                <TriangleAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} noValidate>
              <div className="lg-field">
                <label className="lg-label" htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  className={`lg-input${emailErr ? " has-err" : ""}`}
                  placeholder="vos@empresa.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailErr(false); }}
                  disabled={submitting}
                />
                {emailErr && <span className="lg-err">Requerido</span>}
              </div>

              <div className="lg-field">
                <label className="lg-label" htmlFor="password">Contraseña</label>
                <div className="lg-inputwrap">
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    className={`lg-input lg-input--pass${passErr ? " has-err" : ""}`}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPassErr(false); }}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="lg-eye"
                    onClick={() => setShowPass((s) => !s)}
                    aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passErr && <span className="lg-err">Requerido</span>}
              </div>

              <button type="submit" className="lg-btn" disabled={submitting}>
                {submitting ? <span className="lg-spin" /> : "Entrar"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
