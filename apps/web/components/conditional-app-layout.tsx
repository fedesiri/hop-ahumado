"use client";

import { AppLayout } from "@/components/app-layout";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ConditionalAppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return <>{children}</>;
  }
  return <AppLayout>{children}</AppLayout>;
}
