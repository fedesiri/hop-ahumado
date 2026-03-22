import { AntdProvider } from "@/components/antd-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import "@/lib/dayjs";
import "@ant-design/v5-patch-for-react-19";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hop Ahumado - Gestión de Negocios",
  description: "Sistema de gestión para Hop Ahumado - Carnes ahumadas y Cerveza artesanal",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className={`${inter.className} antialiased`} style={{ backgroundColor: "#0a0a0a" }}>
        <AntdProvider>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-center" />
            <Analytics />
          </AuthProvider>
        </AntdProvider>
      </body>
    </html>
  );
}
