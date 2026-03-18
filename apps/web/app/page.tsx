"use client";

import { AppLayout } from "@/components/app-layout";
import { Dashboard } from "@/components/dashboard";
import { LineProvider } from "@/lib/line-context";

export default function Home() {
  return (
    <LineProvider>
      <AppLayout>
        <Dashboard />
      </AppLayout>
    </LineProvider>
  );
}
