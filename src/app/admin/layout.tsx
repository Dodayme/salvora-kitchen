import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { RequireRole } from "@/components/auth/require-role";
export default function AdminLayout({ children }: { children: ReactNode }) { return <RequireRole role="ADMIN"><AdminShell>{children}</AdminShell></RequireRole>; }
