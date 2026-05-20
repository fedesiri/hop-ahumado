"use client";

import { AppLayout } from "@/components/app-layout";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
