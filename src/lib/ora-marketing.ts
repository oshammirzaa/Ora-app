import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { parseRate } from "@/lib/ora";
import { publicAdvisorPresence } from "@/lib/ora-advisor-schedule";
import {
  publicReviewerName,
  safeOrigin,
  safePublicPhoto,
  safeSupportEmail,
  robotsTxt,
  sitemapXml,
  type MarketingAdvisor,
  type MarketingPageData,
  type MarketingReview,
} from "./ora-marketing-copy.ts";
import { hostFromHeaders, isMarketingHost } from "./ora-domains.ts";

const ADVISOR_LIMIT = 12;
const REVIEW_LIMIT = 9;

function clip(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function mapAdvisor(row: Record<string, unknown>): MarketingAdvisor | null {
  const id = clip(row.id, 80);
  if (!id) return null;
  const floor = publicAdvisorPresence(row);
  const reviews = Math.max(0, Math.floor(Number(row.reviews) || 0));
  const ratingRaw = Number(row.rating);
  return {
    id,
    name: clip(row.name, 80) || "Advisor",
    specialties: clip(row.specialties, 180),
    rateCoins: parseRate(row.rate_coins) ?? 0,
    photoUrl: safePublicPhoto(row.photo_url),
    rating: reviews > 0 && Number.isFinite(ratingRaw) ? Math.round(ratingRaw * 10) / 10 : 0,
    reviews,
    online: floor.online,
    busy: floor.busy,
    house: String(row.user_id || "").startsWith("seed:"),
  };
}

async function loadAdvisors(): Promise<MarketingAdvisor[]> {
  const sql = await getSql();
  const full = `select id, user_id, name, specialties, rate_coins, photo_url, rating, reviews, online, busy,
      coalesce(away, false) as away, coalesce(hours_json, '') as hours_json, coalesce(schedule_tz, '') as schedule_tz
    from ora_advisors where status = 'live'`;
  const basic = `select id, user_id, name, specialties, rate_coins, photo_url, rating, reviews, online, busy
    from ora_advisors where status = 'live'`;
  let rows: Record<string, unknown>[] = [];
  try {
    rows = (await sql.query(full)) as Record<string, unknown>[];
  } catch {
    try {
      rows = (await sql.query(basic)) as Record<string, unknown>[];
    } catch {
      return [];
    }
  }
  return rows
    .map((row) => mapAdvisor(row))
    .filter((row): row is MarketingAdvisor => Boolean(row))
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (a.busy !== b.busy) return a.busy ? 1 : -1;
      if (b.reviews !== a.reviews) return b.reviews - a.reviews;
      return a.name.localeCompare(b.name);
    });
}

async function loadReviews(): Promise<MarketingReview[]> {
  const sql = await getSql();
  try {
    const rows = await sql<{
      id: string;
      rating: number;
      body: string;
      created_at: string;
      client_name: string;
      advisor_name: string;
      advisor_id: string;
    }>`
      select r.id, r.rating, r.body, r.created_at::text as created_at,
             coalesce(nullif(p.display_name, ''), 'Client') as client_name,
             a.name as advisor_name, a.id as advisor_id
      from ora_reviews r
      join ora_advisors a on a.id = r.advisor_id and a.status = 'live'
      left join ora_profiles p on p.user_id = r.client_id
      where r.hidden = false
        and r.rating between 1 and 5
        and length(trim(r.body)) > 0
      order by r.created_at desc
      limit ${REVIEW_LIMIT}
    `;
    return rows.map((row) => ({
      id: clip(row.id, 80),
      rating: Math.min(5, Math.max(1, Math.floor(Number(row.rating) || 0))),
      body: clip(row.body, 300),
      at: clip(row.created_at, 40),
      name: publicReviewerName(row.client_name),
      advisorName: clip(row.advisor_name, 80) || "Advisor",
      advisorId: clip(row.advisor_id, 80),
    })).filter((row) => row.id && row.body);
  } catch {
    return [];
  }
}

async function loadContact() {
  try {
    const sql = await getSql();
    const [row] = await sql<{ name: string; support_email: string }>`
      select name, support_email from ora_settings where id = 'ora' limit 1
    `;
    return {
      siteName: clip(row?.name, 40) || "Ora",
      supportEmail: safeSupportEmail(row?.support_email),
    };
  } catch {
    return { siteName: "Ora", supportEmail: "" };
  }
}

export const loadPublicMarketing = createServerFn({ method: "GET" }).handler(async () => {
  const [contact, advisors, reviews, origin] = await Promise.all([
    loadContact(),
    loadAdvisors().catch(() => [] as MarketingAdvisor[]),
    loadReviews().catch(() => [] as MarketingReview[]),
    requestOrigin(),
  ]);
  return {
    siteName: contact.siteName,
    supportEmail: contact.supportEmail,
    origin,
    advisorCount: advisors.length,
    advisors: advisors.slice(0, ADVISOR_LIMIT),
    reviews,
  } satisfies MarketingPageData;
});

async function requestOrigin() {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    return safeOrigin(request?.url || "");
  } catch {
    return "";
  }
}

export const loadMarketingHost = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const hostname = hostFromHeaders(request.headers);
    return { marketingHost: isMarketingHost(hostname) };
  } catch {
    return { marketingHost: false };
  }
});

export async function publicRobotsResponse(request: Request) {
  return new Response(robotsTxt(request.url), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

export async function publicSitemapResponse(request: Request) {
  return new Response(sitemapXml(request.url), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
