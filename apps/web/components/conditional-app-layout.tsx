"use client";

import { AppLayout } from "@/components/app-layout";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function ConditionalAppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    console.log("[ConditionalAppLayout] mounted");
    return () => console.log("[ConditionalAppLayout] unmounted");
  }, []);

  useEffect(() => {
    console.log("[ConditionalAppLayout] pathname changed →", pathname);
  }, [pathname]);

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return <>{children}</>;
  }
  return <AppLayout>{children}</AppLayout>;
}
