"use client";

import { AppLayout } from "@/components/app-layout";
import { LineProvider } from "@/lib/line-context";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <LineProvider>
      <AppLayout showLineTabs={false}>{children}</AppLayout>
    </LineProvider>
  );
}
