"use client";

import { AppLayout } from "@/components/app-layout";
import type { ReactNode } from "react";

export default function UsersLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
