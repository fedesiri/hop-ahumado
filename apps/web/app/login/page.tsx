"use client";

import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "@/lib/auth-context";
import { getFirebaseAuth } from "@/lib/firebase";
import { useMediaQuery } from "@/lib/use-media-query";
import { ApiOutlined } from "@ant-design/icons";
import { App, Button, Card, Form, Input, Spin } from "antd";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { message } = App.useApp();
  const { refresh } = useAuth();

  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const getFromPath = () => {
    if (typeof window === "undefined") return "/";
    return new URLSearchParams(window.location.search).get("from") || "/";
  };

  // Si ya tenés sesión, no tiene sentido mostrar el login.
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const res = await authFetch(`${API_URL}/auth/me`, {
          method: "GET",
        });
        if (mounted && res.ok) {
          router.replace(getFromPath());
          return;
        }
      } catch {
        // No autenticado o backend caído: mostramos el login.
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  const [form] = Form.useForm();

  const onFinish = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, values.email, values.password);

      message.success("Sesión iniciada");
      await refresh();
      router.replace(getFromPath());
    } catch (e: any) {
      message.error(e?.message || "Error al iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  const cardStyle = useMemo(
    () => ({
      background: "#1f2937",
      border: "1px solid #2d3748",
      borderRadius: 8,
      width: "100%",
      maxWidth: 420,
      padding: isMobile ? 16 : 24,
    }),
    [isMobile],
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 12 : 24,
        background: "#0a0a0a",
      }}
    >
      <Card style={cardStyle} styles={{ body: { padding: isMobile ? 16 : 24 } }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <ApiOutlined style={{ color: "#22c55e", fontSize: 28 }} />
          <div>
            <h1 style={{ margin: 0, color: "#ffffff", fontSize: 20, fontWeight: 700 }}>Iniciar sesión</h1>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>Acceso para usuarios autorizados por Firebase.</p>
          </div>
        </div>

        {checkingSession ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <Spin />
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: "Ingresá tu email" },
                { type: "email", message: "Email inválido" },
              ]}
            >
              <Input
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                style={{ background: "#111111", borderColor: "#2d3748", color: "#ffffff" }}
                disabled={submitting}
              />
            </Form.Item>

            <Form.Item
              label="Contraseña"
              name="password"
              rules={[{ required: true, message: "Ingresá tu contraseña" }]}
            >
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ background: "#111111", borderColor: "#2d3748", color: "#ffffff" }}
                disabled={submitting}
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 16 }}>
              <Button
                htmlType="submit"
                type="primary"
                loading={submitting}
                disabled={submitting}
                style={{ width: "100%", background: "#22c55e", borderColor: "#22c55e" }}
              >
                Entrar
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
}
