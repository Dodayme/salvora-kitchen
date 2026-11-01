"use client";
import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";

type ControlAttributes = { id: string; "aria-invalid": boolean; "aria-describedby"?: string };
export function FormField({ id: providedId, label, hint, error, required, children }: {
  id?: string; label: string; hint?: string; error?: string; required?: boolean; children: (attributes: ControlAttributes) => ReactNode;
}) {
  const generated = useId(), id = providedId ?? generated;
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}{required && <span aria-hidden="true" className="text-destructive"> *</span>}</Label>
    {children({ id, "aria-invalid": !!error, "aria-describedby": description })}
    {hint && <p id={`${id}-hint`} className="text-sm leading-relaxed text-muted-foreground">{hint}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">{error}</p>}
  </div>;
}
