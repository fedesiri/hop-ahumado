import { ConditionalAppLayout } from "@/components/conditional-app-layout";
import { RequireAuth } from "@/components/require-auth";
import { ToastContainer } from "@/components/toast-container";
import { AuthProvider } from "@/lib/auth-context";
import "@/lib/dayjs";
import { LineProvider } from "@/lib/line-context";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hop - Alumo | Gestión de Negocios",
  description: "Sistema de gestión para Hop - Alumo: Cerveza artesanal y Carnes ahumadas",
  generator: "v0.app",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning data-theme="light">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <RequireAuth>
            <LineProvider>
              <ConditionalAppLayout>{children}</ConditionalAppLayout>
            </LineProvider>
          </RequireAuth>
          <ToastContainer />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}
