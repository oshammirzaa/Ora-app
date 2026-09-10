import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPreload: false,
    defaultPreloadStaleTime: 20_000,
    defaultPendingMs: 2000,
    defaultGcTime: 60_000,
  });
}
