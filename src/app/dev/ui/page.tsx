import { notFound } from "next/navigation";
import { UiPreview } from "./ui-preview";

export default function UiPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UiPreview />;
}
