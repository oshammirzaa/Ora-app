import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const customer = { name: "Paid Client", email: "paid-mtudgdtq@ora.test", password: "testpass123" };
const READING = "read_mtudgjzc28513";
const PAID_MS = 90 * 1000;

const report = [];
function ok(m) {
  report.push("OK  " + m);
  console.log("OK  " + m);
}
function fail(m) {
  report.push("FAIL " + m);
  console.log("FAIL " + m);
}

async function snapshot() {
  const res = await fetch(`${BASE}/api/qa-state`);
  return res.json();
}

function parseClock(text) {
  const m = String(text || "").match(/(\d+):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function expectedCoins(paidSeconds, rate) {
  return Math.floor((Math.max(0, paidSeconds) * rate) / 60);
}

function splitCoins(coins, pct = 30) {
  const c = Math.max(0, Math.floor(coins));
  const advisorEarned = Math.floor((c * (100 - pct)) / 100);
  return { advisorEarned, platformFee: c - advisorEarned };
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (err) => {
  const text = String(err.stack || err);
  if (/Hydration failed/i.test(text)) return;
  pageErrors.push(text);
  console.log("PAGEERROR", err.message);
});

try {
  const before = await snapshot();
  if (before.error) throw new Error("snapshot failed: " + before.error);
  const beforeAdvisors = Number(before.finance?.advisors || 0);
  const beforeSpent = Number(before.finance?.spent || 0);
  const beforeEarned = Number(before.finance?.earned || 0);
  const beforeHouse = Number(before.finance?.commission || 0);
  const beforePayout = Number(before.amara?.payout_coins || 0);
  const amaraRate = Number(before.amara?.rate_coins || 27);
  const share = Number(before.settings?.platformShare || 30);
  const welcome = Number(before.settings?.welcomeSeconds || 180);
  const me = (before.customers || []).find((c) => c.email === customer.email);
  if (!me) throw new Error("current test customer missing");
  const coinsAtStart = Number(me.coins);
  ok(
    `resume customer ${me.email} coins=${coinsAtStart} bonus=${me.bonus_seconds} spent=${beforeSpent} house=${beforeHouse} amaraRate=${amaraRate}`,
  );
  if (beforeAdvisors < 18) fail("advisor floor changed: " + beforeAdvisors);
  else ok("advisor floor intact (" + beforeAdvisors + ")");

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").waitFor();
  await page.waitForTimeout(600);
  await page.getByLabel("Email").fill(customer.email);
  await page.locator("#pw").or(page.getByLabel("Password", { exact: true })).fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  ok("signed in " + customer.email);

  await page.goto(`${BASE}/reading/${READING}`, { waitUntil: "domcontentloaded" });
  const clockEl = () => page.locator(".text-5xl").first();
  await clockEl().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  let lastClock = await clockEl().innerText();
  ok("resumed live chat timer " + lastClock + " " + page.url());
  const liveBody = await page.locator("body").innerText();
  if (/something went wrong/i.test(liveBody)) throw new Error("error overlay on resume: " + liveBody.slice(0, 240));
  const shownRate = Number((liveBody.match(/(\d+)c \/ min/) || [])[1] || amaraRate);
  ok("live rate " + shownRate + "c/min");
  if (shownRate !== amaraRate) fail(`live rate ${shownRate} != Amara ${amaraRate}`);

  const burnUntil = Date.now() + 200000;
  let paidStartedAt = null;
  while (Date.now() < burnUntil) {
    const body = await page.locator("body").innerText();
    if (/something went wrong|cannot read propert/i.test(body)) {
      fail("error while reaching paid time: " + body.slice(0, 300));
      break;
    }
    const nowClock = await clockEl().innerText().catch(() => "");
    if (nowClock && nowClock !== lastClock) lastClock = nowClock;
    const secs = parseClock(nowClock);
    const charged = Number((body.match(/(\d+)c charged/) || [])[1] || 0);
    const includedGone = /of paid time left/i.test(body) || /Included left 0:00/.test(body);
    const welcomeDone = includedGone || charged > 0 || (secs != null && secs >= welcome - 1);
    console.log(`burn clock=${nowClock} charged=${charged} welcomeDone=${welcomeDone}`);
    if (welcomeDone) {
      paidStartedAt = Date.now();
      ok(`welcome exhausted at ${nowClock} charged=${charged}c`);
      break;
    }
    await page.waitForTimeout(4000);
  }
  if (!paidStartedAt) throw new Error("welcome minutes were not exhausted");
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-after-welcome.png", fullPage: true });

  const prompts = ["What should I know now that this is a paid sitting?", "Give me one clear next step."];
  for (const text of prompts) {
    const box = page.locator('input[placeholder="Ask what you need…"]');
    if (!(await box.count())) {
      fail("compose missing during paid chat");
      break;
    }
    await box.fill(text);
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByText(text, { exact: false }).waitFor({ timeout: 25000 });
    ok("paid message visible: " + text.slice(0, 40));
  }

  const paidT0 = Date.now();
  while (Date.now() - paidT0 < PAID_MS) {
    await page.waitForTimeout(8000);
    const body = await page.locator("body").innerText();
    if (/something went wrong|cannot read propert/i.test(body)) {
      fail("error overlay during paid session: " + body.slice(0, 300));
      await page.screenshot({ path: "/workspace/screenshots/qa-paid-error.png", fullPage: true });
      break;
    }
    const nowClock = await clockEl().innerText().catch(() => "");
    if (nowClock && nowClock === lastClock) fail("timer frozen at " + nowClock);
    else if (nowClock) {
      lastClock = nowClock;
      ok("timer moving " + nowClock);
    }
    console.log(`paid ${Math.round((Date.now() - paidT0) / 1000)}s clock=${nowClock} charged=${(body.match(/(\d+)c charged/) || [])[1]}`);
  }

  const bodyBeforeEnd = await page.locator("body").innerText();
  const chargedBeforeEnd = Number((bodyBeforeEnd.match(/(\d+)c charged/) || [])[1] || 0);
  ok(`pre-end clock=${lastClock} charged=${chargedBeforeEnd}c`);
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-live.png", fullPage: true });

  if (await page.getByRole("button", { name: "End reading" }).count()) {
    await page.getByRole("button", { name: "End reading" }).click();
    await page.waitForTimeout(2500);
  }
  const endedBody = await page.locator("body").innerText();
  if (!/ended|session closed/i.test(endedBody)) fail("session did not end: " + endedBody.slice(0, 250));
  else ok("session ended");
  const endedClock = parseClock(endedBody) ?? parseClock(lastClock) ?? 0;
  const endedCharge = Number((endedBody.match(/(\d+)c charged/) || [])[1] || chargedBeforeEnd);
  const paidSeconds = Math.max(0, endedClock - welcome);
  const expect = expectedCoins(paidSeconds, shownRate);
  const split = splitCoins(endedCharge, share);
  ok(`ended ${endedClock}s · paid ~${paidSeconds}s · charged ${endedCharge}c · expect ~${expect}c at ${shownRate}c/min`);
  const alt = expectedCoins(paidSeconds + 2, shownRate);
  if (endedCharge >= 1 && (Math.abs(endedCharge - expect) <= 1 || Math.abs(endedCharge - alt) <= 1)) {
    ok("wallet charge matches elapsed paid time");
  } else fail(`charge mismatch charged=${endedCharge} expected=${expect} paidSeconds=${paidSeconds} rate=${shownRate}`);
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-ended.png", fullPage: true });

  await page.goto(`${BASE}/me`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const meBody = await page.locator("body").innerText();
  if (/Amara/i.test(meBody)) ok("session history includes Amara sitting");
  else fail("session history missing Amara: " + meBody.slice(0, 400));
  if (new RegExp(`${endedCharge}c`).test(meBody)) ok("session history shows charged coins");
  if (/Owner gift · 200|\+200c/.test(meBody)) ok("wallet history shows +200 gift");
  else fail("wallet history missing gift: " + meBody.slice(0, 400));
  if (/Reading ·/.test(meBody)) ok("wallet history shows reading debit");
  else fail("wallet history missing reading transaction: " + meBody.slice(0, 400));
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-history.png", fullPage: true });

  await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-wallet-after.png", fullPage: true });

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 15000 });
  ok("admin overview loaded");
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-admin-overview.png", fullPage: true });

  await page.goto(`${BASE}/admin/finance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const finBody = await page.locator("body").innerText();
  if (/Customer spend/i.test(finBody) && /Advisor earnings/i.test(finBody) && /House commission/i.test(finBody)) {
    ok("finance shows spend, advisor earnings, house commission");
  } else fail("finance missing cards: " + finBody.slice(0, 300));
  if (/Reading ·/i.test(finBody)) ok("finance ledger includes reading");
  else fail("finance ledger missing reading");
  if (/Owner gift · 200/i.test(finBody)) ok("finance ledger includes gift");
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-admin-finance.png", fullPage: true });

  await page.goto(`${BASE}/admin/sessions`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const sessBody = await page.locator("body").innerText();
  if (/Amara/i.test(sessBody) && /Paid Client/i.test(sessBody)) ok("admin sessions lists the sitting");
  else fail("admin sessions missing sitting: " + sessBody.slice(0, 400));
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-admin-sessions.png", fullPage: true });

  const after = await snapshot();
  const afterSpent = Number(after.finance?.spent || 0);
  const afterEarned = Number(after.finance?.earned || 0);
  const afterHouse = Number(after.finance?.commission || 0);
  const afterPayout = Number(after.amara?.payout_coins || 0);
  const afterAdvisors = Number(after.finance?.advisors || 0);
  const deltaSpend = afterSpent - beforeSpent;
  const deltaEarned = afterEarned - beforeEarned;
  const deltaHouse = afterHouse - beforeHouse;
  const deltaPayout = afterPayout - beforePayout;
  ok(`db delta spend=${deltaSpend} earned=${deltaEarned} house=${deltaHouse} amaraPayout=${deltaPayout}`);
  if (deltaSpend !== endedCharge) fail(`finance spend delta ${deltaSpend} != charged ${endedCharge}`);
  else ok("admin customer spend matches this sitting");
  if (deltaEarned + deltaHouse !== endedCharge) fail(`earned ${deltaEarned} + house ${deltaHouse} != ${endedCharge}`);
  else ok("advisor earnings + house revenue equal the same charge");
  if (deltaEarned !== split.advisorEarned) fail(`advisor earned ${deltaEarned} expected ${split.advisorEarned}`);
  else ok(`advisor earned ${deltaEarned}c`);
  if (deltaHouse !== split.platformFee) fail(`house ${deltaHouse} expected ${split.platformFee}`);
  else ok(`house revenue ${deltaHouse}c`);
  if (deltaPayout !== deltaEarned) fail(`Amara payout ${deltaPayout} != earned ${deltaEarned}`);
  else ok("Amara payout increased by the same earning");
  if (afterAdvisors !== beforeAdvisors) fail("advisor count changed");
  else ok("advisor records unchanged in count");

  const leftover = (after.customers || []).find((c) => c.email === customer.email);
  if (leftover) {
    const expectWallet = coinsAtStart - endedCharge;
    if (Number(leftover.coins) === expectWallet) ok(`customer wallet now ${leftover.coins}c`);
    else fail(`wallet now ${leftover.coins} expected ${expectWallet} (start ${coinsAtStart} minus ${endedCharge})`);
    if (Number(leftover.bonus_seconds) > 5) fail("welcome minutes still left: " + leftover.bonus_seconds);
    else ok("welcome minutes exhausted");
  }

  if (pageErrors.length) fail("page errors:\n" + pageErrors.join("\n"));
  else ok("no page errors");
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-throw.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.some((l) => l.startsWith("FAIL"));
  console.log(failed ? "RESULT FAIL" : "RESULT PASS");
  console.log(report.join("\n"));
  await browser.close();
  if (failed) process.exit(1);
}
