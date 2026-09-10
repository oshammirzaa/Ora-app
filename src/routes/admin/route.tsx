import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-shell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});
