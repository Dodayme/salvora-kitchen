"use client";
import type { ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ActionButton({ pending, disabled, children, ...props }: Omit<ComponentProps<typeof Button>, "asChild"> & { pending?: boolean }) {
  return <Button {...props} disabled={disabled || pending} aria-busy={pending || undefined}>{pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}{children}</Button>;
}
