import { createFileRoute } from "@tanstack/react-router";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/qa-state")({
  server: {
    handlers: {
      GET: async () => new Response(null, { status: 404 }),
      POST: async ({ request }) => {
        const { isWorkspacePreview } = await import("@/lib/env.server");
        if (!isWorkspacePreview()) return new Response(null, { status: 404 });
        const { requireUserId, UnauthorizedError } = await import("@/lib/auth/verify.server");
        try {
          const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
          const userId = await requireUserId(bearer);
          const body = (await request.json().catch(() => ({}))) as {
            op?: string;
            refreshAgoHours?: number;
            expireAgoHours?: number;
            spendSeconds?: number;
            advisorId?: string;
            online?: boolean;
            busy?: boolean;
          };
          if (body.op === "membershipClock") {
            const { applyMembershipClock } = await import("@/lib/ora-membership");
            return json(await applyMembershipClock(userId, body));
          }
          if (body.op === "advisorPresence") {
            const sql = await (await import("@/lib/db")).getSql();
            const id = String(body.advisorId || "").slice(0, 64);
            const [row] = await sql<{ id: string; name: string }>`
              select id, name from ora_advisors where id = ${id} or slug = ${id}
            `;
            if (!row) return json({ error: "Advisor not found." }, 400);
            await sql`
              update ora_advisors
              set online = ${Boolean(body.online)}, busy = ${Boolean(body.busy)}
              where id = ${row.id}
            `;
            return json({ ok: true, id: row.id, name: row.name, online: Boolean(body.online), busy: Boolean(body.busy) });
          }
          return json({ error: "Unknown op." }, 400);
        } catch (err) {
          const status = err instanceof UnauthorizedError ? 401 : 400;
          return json({ error: err instanceof Error ? err.message : "QA failed." }, status);
        }
      },
    },
  },
});
