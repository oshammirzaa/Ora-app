import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cachedMe } from "@/lib/client-cache";
import {
  accountHomePath,
  resolveOraMarkTarget,
  type OraMarkTarget,
} from "@/lib/ora-home-route";

const rootRoute = getRouteApi("__root__");

export function useMarketingWebsite() {
  return rootRoute.useLoaderData().website;
}

/** Signed-in profile role on orapsychic.com. Empty on the app host so .xyz does not fetch. */
export function useAccountRole() {
  const website = useMarketingWebsite();
  const { user, isPending } = useCurrentUserState();
  const [role, setRole] = useState("");

  useEffect(() => {
    if (!website || isPending) return;
    if (!user) {
      setRole("");
      return;
    }
    let alive = true;
    void cachedMe()
      .then((me) => {
        if (alive) setRole(String(me.role || ""));
      })
      .catch(() => {
        if (alive) setRole("");
      });
    return () => {
      alive = false;
    };
  }, [website, isPending, user?.id]);

  return website ? role : "";
}

/** Home link that resolves role before leaving the page when it is not known yet. */
export function useAccountHomeLink() {
  const website = useMarketingWebsite();
  const role = useAccountRole();
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const to = accountHomePath({ role, marketingHost: website });

  function onClick(event: { preventDefault(): void }) {
    if (!website || !user || role) return;
    event.preventDefault();
    void cachedMe()
      .then((me) => {
        const next = accountHomePath({ role: me.role, marketingHost: true });
        void navigate({ to: next, replace: next === "/advisor" });
      })
      .catch(() => {
        void navigate({ to: "/home" });
      });
  }

  return { to, onClick };
}

export function useOraMarkTarget(to: OraMarkTarget) {
  const website = useMarketingWebsite();
  const role = useAccountRole();
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const dest = resolveOraMarkTarget(to, { marketingHost: website, role });

  function onClick(event: { preventDefault(): void }) {
    if (!website || !user || role) return;
    event.preventDefault();
    void cachedMe()
      .then((me) => {
        const next = resolveOraMarkTarget(to, { marketingHost: true, role: me.role });
        void navigate({ to: next, replace: next === "/advisor" });
      })
      .catch(() => {
        void navigate({ to: dest });
      });
  }

  return { dest, onClick };
}
