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
            amountCents?: number;
            status?: string;
            gender?: string;
            dateOfBirth?: string;
            coins?: number;
            count?: number;
            seconds?: number;
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
          if (body.op === "loyaltyPayment" || body.op === "loyaltyGender" || body.op === "loyaltyRefund") {
            const { ensureLoyaltySchema, loadLoyaltyForUser } = await import("@/lib/ora-loyalty");
            const { normalizeGender } = await import("@/lib/ora-advisor-desk-stats");
            const { COINS_PER_DOLLAR, rid } = await import("@/lib/ora");
            await ensureLoyaltySchema();
            const sql = await (await import("@/lib/db")).getSql();
            if (body.op === "loyaltyPayment") {
              const amountCents = Math.max(0, Math.floor(Number(body.amountCents) || 0));
              const rawStatus = String(body.status || "succeeded").toLowerCase();
              const status = ["refunded", "failed", "cancelled", "pending", "created"].includes(rawStatus)
                ? rawStatus
                : "succeeded";
              if (amountCents > 0) {
                const id = rid("pay");
                const coins = Math.max(0, Math.round((amountCents / 100) * COINS_PER_DOLLAR));
                const paid = status === "succeeded" || status === "refunded";
                await sql`
                  insert into ora_payments (
                    id, user_id, pack_id, provider, provider_ref, amount_cents, currency, coins,
                    status, idempotency_key, return_to, paid_at, created_at, updated_at
                  ) values (
                    ${id}, ${userId}, 'qa-loyalty', 'sandbox', '', ${amountCents}, 'USD', ${coins},
                    ${status}, ${`qa-loyalty-${id}`}, '', ${paid ? new Date().toISOString() : null}, now(), now()
                  )
                `;
              }
            }
            if (body.op === "loyaltyRefund") {
              const [row] = await sql<{ id: string }>`
                select id from ora_payments
                where user_id = ${userId} and status = 'succeeded'
                order by created_at desc
                limit 1
              `;
              if (row) {
                await sql`
                  update ora_payments set status = 'refunded', updated_at = now()
                  where id = ${row.id} and status = 'succeeded'
                `;
              }
            }
            if (body.gender !== undefined || body.op === "loyaltyGender") {
              const gender = normalizeGender(body.gender);
              await sql`update ora_profiles set gender = ${gender} where user_id = ${userId}`;
            }
            if (body.dateOfBirth !== undefined) {
              const { parseBirthDate } = await import("@/lib/ora-advisor-desk-stats");
              const dob = parseBirthDate(body.dateOfBirth);
              await sql`update ora_profiles set date_of_birth = ${dob} where user_id = ${userId}`;
            }
            const loyalty = await loadLoyaltyForUser(userId);
            return json({ ok: true, ...loyalty });
          }
          if (body.op === "clientDateOfBirth") {
            const { ensureLoyaltySchema } = await import("@/lib/ora-loyalty");
            const { parseBirthDate } = await import("@/lib/ora-advisor-desk-stats");
            await ensureLoyaltySchema();
            const sql = await (await import("@/lib/db")).getSql();
            const dob = parseBirthDate(body.dateOfBirth);
            await sql`update ora_profiles set date_of_birth = ${dob} where user_id = ${userId}`;
            return json({ ok: true, dateOfBirth: dob });
          }
          if (body.op === "loyaltySeedReading") {
            const sql = await (await import("@/lib/db")).getSql();
            const { rid } = await import("@/lib/ora");
            const id = String(body.advisorId || "").slice(0, 64);
            const [adv] = await sql<{ id: string; name: string }>`
              select id, name from ora_advisors where id = ${id} or slug = ${id} or name = ${id}
            `;
            if (!adv) return json({ error: "Advisor not found." }, 400);
            const readingId = rid("rd");
            const activityId = rid("act");
            const live = String(body.status || "ended").toLowerCase() === "live";
            await sql`
              insert into ora_readings (id, client_id, advisor_id, status, seconds, coins_spent, rate_coins, last_billed_at)
              values (${readingId}, ${userId}, ${adv.id}, ${live ? "live" : "ended"}, 60, 0, 20, now())
            `;
            if (!live) {
              await sql`update ora_readings set ended_at = now() where id = ${readingId}`;
            }
            await sql`
              insert into ora_reading_activity (
                id, advisor_id, customer_id, reading_id, started_at, ended_at, seconds, minutes,
                coins_spent, advisor_earnings, platform_revenue
              ) values (
                ${activityId}, ${adv.id}, ${userId}, ${readingId}, now(),
                ${live ? null : new Date().toISOString()}, 60, 1, 0, 0, 0
              )
            `.catch((err) => console.error("[ora] qa activity", err));
            return json({ ok: true, readingId, advisorId: adv.id, advisorName: adv.name, live });
          }
          if (body.op === "pendingChatRequest") {
            const sql = await (await import("@/lib/db")).getSql();
            const { rid } = await import("@/lib/ora");
            const id = String(body.advisorId || "").slice(0, 64);
            const [adv] = await sql<{ id: string; name: string }>`
              select id, name from ora_advisors where id = ${id} or slug = ${id} or name = ${id}
            `;
            if (!adv) return json({ error: "Advisor not found." }, 400);
            const requestId = rid("req");
            await sql`
              insert into ora_chat_requests (id, client_id, advisor_id, status, created_at)
              values (${requestId}, ${userId}, ${adv.id}, 'pending', now())
            `;
            return json({ ok: true, requestId, advisorId: adv.id });
          }
          if (body.op === "seedPaidReading") {
            const sql = await (await import("@/lib/db")).getSql();
            const { rid, creditAdvisorEarning } = await import("@/lib/ora");
            const { panelSplit } = await import("@/lib/ora-advisor-auth");
            const id = String(body.advisorId || "").slice(0, 64);
            const coins = Math.max(10, Math.floor(Number(body.coins) || 100));
            const seconds = Math.max(1, Math.floor(Number(body.seconds) || 60));
            const split = panelSplit(coins);
            const [adv] = await sql<{ id: string; name: string }>`
              select id, name from ora_advisors where id = ${id} or slug = ${id} or name = ${id}
            `;
            if (!adv) return json({ error: "Advisor not found." }, 400);
            const readingId = rid("rd");
            const activityId = rid("act");
            await sql`
              insert into ora_readings (
                id, client_id, advisor_id, status, seconds, coins_spent, advisor_earned, platform_fee, rate_coins, last_billed_at, ended_at
              ) values (
                ${readingId}, ${userId}, ${adv.id}, 'ended', ${seconds}, ${coins}, ${split.advisorEarnings}, ${split.platformRevenue}, 20, now(), now()
              )
            `;
            await sql`
              insert into ora_reading_activity (
                id, advisor_id, customer_id, reading_id, started_at, ended_at, seconds, minutes,
                coins_spent, advisor_earnings, platform_revenue
              ) values (
                ${activityId}, ${adv.id}, ${userId}, ${readingId}, now(), now(), ${seconds}, ${Math.max(1, Math.round(seconds / 60))},
                ${coins}, ${split.advisorEarnings}, ${split.platformRevenue}
              )
            `.catch((err) => console.error("[ora] qa paid activity", err));
            await creditAdvisorEarning(adv.id, readingId, coins, split.platformRevenue, split.advisorEarnings);
            return json({
              ok: true,
              readingId,
              advisorId: adv.id,
              coins,
              advisorEarned: split.advisorEarnings,
            });
          }
          if (body.op === "seedInboxMessages") {
            const sql = await (await import("@/lib/db")).getSql();
            const { rid } = await import("@/lib/ora");
            const { ensureAdvisorDeskTables } = await import("@/lib/ora-advisor-desk");
            await ensureAdvisorDeskTables();
            const id = String(body.advisorId || "").slice(0, 64);
            const count = Math.min(40, Math.max(1, Math.floor(Number(body.count) || 1)));
            const [adv] = await sql<{ id: string }>`
              select id from ora_advisors where id = ${id} or slug = ${id} or name = ${id}
            `;
            if (!adv) return json({ error: "Advisor not found." }, 400);
            const [thread] = await sql<{ id: string }>`
              select id from ora_advisor_inbox where advisor_id = ${adv.id} and customer_id = ${userId}
            `;
            let threadId = thread?.id || "";
            if (!threadId) {
              threadId = rid("th");
              await sql`
                insert into ora_advisor_inbox (id, advisor_id, customer_id, last_body, last_role, last_at)
                values (${threadId}, ${adv.id}, ${userId}, 'qa', 'advisor', now())
              `;
            }
            for (let i = 0; i < count; i += 1) {
              const msgId = rid("im");
              await sql`
                insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body, kind)
                values (${msgId}, ${threadId}, ${adv.id}, ${userId}, 'advisor', ${`qa ${i + 1}`}, 'message')
              `;
            }
            return json({ ok: true, count, advisorId: adv.id });
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
