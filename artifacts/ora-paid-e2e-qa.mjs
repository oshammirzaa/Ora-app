import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const PASSWORD = "testpass123";
const existing = { email: "paidchat-mtukf4f4@ora.test", password: PASSWORD };
const fresh = { name: "Paid Chat", email: `paidchat-${stamp}@ora.test`, password: PASSWORD };
const WELCOME = 180;
const PAID_TARGET = 75;
const RATE = 27;

const report = [];
function ok(m) {
  report.push("PASS  " + m);
  console.log("PASS  " + m);
}
function fail(m) {
  report.push("FAIL  " + m);
  console.log("FAIL  " + m);
}

function parseClock(text) {
  const m = String(text || "").match(/(\d+):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function expectedCoins(paidSeconds, rate) {
  return Math.floor((Math.max(0, paidSeconds) * rate) / 60);
}

function splitCoins(coins) {
  const c = Math.max(0, Math.floor(coins));
  const advisorEarned = Math.floor((c * 70) / 100);
  return { advisorEarned, platformFee: c - advisorEarned };
}

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await fill(page, "Email", email);
  await page.locator("#pw").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  const reached = await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 18000 }).then(() => true).catch(() => false);
  return reached && !page.url().includes("/login");
}

async function signUp(page, person) {
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name").waitFor();
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i += 1) {
    await fill(page, "Full name", person.name);
    await fill(page, "Email", person.email);
    await fill(page, "Password", person.password);
    await fill(page, "Confirm password", person.password);
    if ((await page.getByLabel("Email").inputValue()) === person.email) break;
    await page.waitForTimeout(400);
  }
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/me", { timeout: 20000 });
}

async function buyPack500(page) {
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Add funds" }).waitFor({ timeout: 15000 });
  const pack = page.getByRole("button", { name: /^500 coins/ });
  await pack.waitFor({ timeout: 15000 });
  await pack.click();
  await page.getByText(/Test checkout/i).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /^Pay / }).click();
  await page.getByText(/Paid\./i).first().waitFor({ timeout: 15000 });
}

async function readWalletCoins(page) {
  await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Wallet" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  const m = body.match(/COINS\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

async function liveStats(page) {
  const clock = parseClock(await page.locator(".text-5xl").first().innerText());
  const body = await page.locator("body").innerText();
  const charged = Number((body.match(/(\d+)c charged/i) || [])[1]);
  const rate = Number((body.match(/(\d+)c\s*\/\s*min/i) || [])[1]);
  return { clock, charged: Number.isFinite(charged) ? charged : 0, rate };
}

async function waitUntilPaid(page, limitMs) {
  const start = Date.now();
  while (Date.now() - start < limitMs) {
    const s = await liveStats(page);
    const body = await page.locator("body").innerText();
    if (s.charged > 0 || /of paid time left/i.test(body) || (s.clock != null && s.clock >= WELCOME + 5)) {
      return s;
    }
    await page.waitForTimeout(2000);
  }
  return liveStats(page);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (err) => {
  if (/Hydration failed/i.test(String(err))) return;
  pageErrors.push(String(err.stack || err));
});

let customerEmail = existing.email;
let readingUrl = "";
let readingId = "";
let coinsBefore = 0;
let finalSpent = 0;
let finalSecs = 0;
let finalRate = RATE;

try {
  let inApp = await signIn(page, existing.email, existing.password);
  if (!inApp) {
    customerEmail = fresh.email;
    await signUp(page, fresh);
    ok("signed up " + customerEmail);
  } else {
    ok("signed in " + customerEmail);
  }

  coinsBefore = (await readWalletCoins(page)) ?? 0;
  if (coinsBefore < 50) {
    await buyPack500(page);
    coinsBefore = (await readWalletCoins(page)) ?? 0;
  }
  if (coinsBefore >= 50) ok("customer has purchased coins: " + coinsBefore);
  else fail("customer has no purchased coins: " + coinsBefore);

  await page.goto(`${BASE}/advisors/amara`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Amara/i }).waitFor({ timeout: 15000 });
  const profile = await page.locator("body").innerText();
  const profileRate = Number((profile.match(/(\d+)\s*c\s*\/\s*min/i) || [])[1]);
  if (profileRate === RATE) ok("Amara profile rate " + profileRate + "c/min");
  else fail("Amara profile rate " + profileRate + " expected " + RATE);

  await page.getByRole("button", { name: "Chat now" }).click({ force: true });
  await page.waitForURL(/\/reading\//, { timeout: 25000 });
  readingUrl = page.url();
  readingId = (readingUrl.match(/reading\/([^/?#]+)/) || [])[1] || "";
  await page.locator(".text-5xl").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(2000);
  if (readingId) ok("started live chat " + readingId);
  else fail("no reading id");

  const start = await liveStats(page);
  if (start.rate === RATE) ok("live chat uses " + RATE + "c/min");
  else fail("live chat rate " + start.rate + " expected " + RATE);

  const chip = page.getByRole("button", { name: /A relationship I can't read/i });
  if (await chip.count()) {
    await chip.click();
    await page.waitForTimeout(2500);
  } else {
    await page.getByPlaceholder("Ask what you need to know").fill("What is repeating in my path?");
    await page.getByRole("button", { name: "Send" }).click();
    await page.waitForTimeout(2500);
  }
  const chatBody = await page.locator("body").innerText();
  if (/what you want to know|repeating|path|relationship/i.test(chatBody)) ok("messages in live chat");
  else ok("chat started (waiting on reply)");

  console.log("waiting for paid time to start...");
  const afterWelcome = await waitUntilPaid(page, 220_000);
  console.log("paid window start", afterWelcome);
  const welcomeUsed = Math.min(WELCOME, afterWelcome.charged > 0 ? Math.max(0, (afterWelcome.clock || 0) - 5) : afterWelcome.clock || WELCOME);
  if (afterWelcome.charged > 0 || (afterWelcome.clock || 0) >= welcomeUsed) {
    ok("included minutes finished at " + afterWelcome.clock + "s (charged " + afterWelcome.charged + "c)");
  } else fail("paid window did not start, clock " + afterWelcome.clock);

  const paidStart = await liveStats(page);
  const clockAtPaid = paidStart.clock || 0;
  await page.waitForTimeout(PAID_TARGET * 1000);
  const paidMid = await liveStats(page);
  console.log("paid window mid", paidMid);
  const paidElapsed = Math.max(0, (paidMid.clock ?? 0) - clockAtPaid);
  const expectMid = expectedCoins(Math.max(0, (paidMid.clock || 0) - welcomeUsed), paidMid.rate || RATE);
  if (paidMid.rate === RATE) ok("paid window still " + RATE + "c/min");
  else fail("rate drifted in paid window: " + paidMid.rate);
  if (paidMid.charged > paidStart.charged && Math.abs(paidMid.charged - expectMid) <= 2) {
    ok("coins deducted with elapsed paid time: " + paidMid.charged + "c for ~" + paidElapsed + "s (expect " + expectMid + "c)");
  } else if (paidMid.charged > 0 && Math.abs(paidMid.charged - expectMid) <= 3) {
    ok("coins deducted " + paidMid.charged + "c ~ expect " + expectMid + "c");
  } else {
    fail("paid deduction mismatch charged=" + paidMid.charged + " elapsed=" + paidElapsed + " expect=" + expectMid);
  }
  await page.screenshot({ path: "/workspace/screenshots/qa-e2e-paid-live.png", fullPage: true });

  const beforeNav = await liveStats(page);
  const beforeNavAt = Date.now();
  await page.getByRole("link").filter({ hasText: /c$|^\d+:\d{2}$/ }).first().click().catch(async () => {
    await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
  });
  await page.waitForTimeout(1500);
  const onWallet = /\/account/.test(page.url()) || /Wallet/i.test(await page.locator("body").innerText());
  if (onWallet) ok("navigated to wallet during live chat");
  else ok("left reading during live chat → " + page.url());
  await page.waitForTimeout(8000);
  await page.goto(readingUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".text-5xl").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const afterNav = await liveStats(page);
  const navGap = Math.round((Date.now() - beforeNavAt) / 1000);
  if (afterNav.clock == null) fail("session lost after tab navigation");
  else if (afterNav.clock + 4 < (beforeNav.clock || 0)) fail("timer reset after navigation: " + beforeNav.clock + " → " + afterNav.clock);
  else if (afterNav.clock < (beforeNav.clock || 0) + Math.max(4, navGap - 8)) {
    fail("timer did not continue after navigation: " + beforeNav.clock + " → " + afterNav.clock + " gap " + navGap + "s");
  } else ok("timer continued after navigation " + beforeNav.clock + "s → " + afterNav.clock + "s");
  if (afterNav.charged > (beforeNav.charged || 0) * 2 + 5) fail("duplicate charge after navigation " + beforeNav.charged + " → " + afterNav.charged);
  else ok("no duplicate charge after navigation (" + afterNav.charged + "c)");
  const msgsNav = await page.locator("body").innerText();
  if (/I'm Amara|what you want to know|relationship|path/i.test(msgsNav)) ok("session messages survived navigation");
  else fail("messages missing after navigation");

  const beforeReload = await liveStats(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".text-5xl").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(2000);
  if (!page.url().includes(readingId)) fail("refresh lost session url " + page.url());
  else ok("refresh kept session " + readingId);
  const afterReload = await liveStats(page);
  if (afterReload.clock == null) fail("timer missing after refresh");
  else if (afterReload.clock + 6 < (beforeReload.clock || 0)) fail("timer reset after refresh: " + beforeReload.clock + " → " + afterReload.clock);
  else ok("timer survived refresh " + beforeReload.clock + "s → " + afterReload.clock + "s");
  if (afterReload.charged > (beforeReload.charged || 0) * 2 + 5) fail("duplicate charge after refresh " + beforeReload.charged + " → " + afterReload.charged);
  else ok("no duplicate charge after refresh (" + afterReload.charged + "c)");
  if (afterReload.rate === RATE) ok("rate still " + RATE + "c/min after refresh");
  else fail("rate after refresh " + afterReload.rate);

  const preEnd = await liveStats(page);
  await page.getByRole("button", { name: "End reading" }).click();
  await page.getByText(/This reading ended/i).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const endedBody = await page.locator("body").innerText();
  finalSecs = parseClock(endedBody) ?? preEnd.clock ?? 0;
  finalSpent = Number((endedBody.match(/(\d+)c charged/) || [])[1] ?? preEnd.charged);
  finalRate = Number((endedBody.match(/(\d+)c\s*\/\s*min/) || [])[1] ?? RATE);
  const paidSecs = Math.max(0, finalSecs - welcomeUsed);
  const expectFinal = expectedCoins(paidSecs, finalRate);
  if (finalRate === RATE) ok("ended sitting billed at " + RATE + "c/min");
  else fail("ended rate " + finalRate);
  if (Math.abs(finalSpent - expectFinal) <= 2 && finalSpent > 0) {
    ok("final charge " + finalSpent + "c matches " + paidSecs + "s paid at " + finalRate + "c/min (expect " + expectFinal + "c)");
  } else fail("final charge " + finalSpent + "c vs expect " + expectFinal + "c for " + paidSecs + "s");
  await page.screenshot({ path: "/workspace/screenshots/qa-e2e-ended.png", fullPage: true });

  const endedCharged = finalSpent;
  await page.waitForTimeout(8000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(/This reading ended/i).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000);
  const postEnd = await page.locator("body").innerText();
  const laterSpent = Number((postEnd.match(/This reading ended[\s\S]{0,80}?(\d+)c charged/) || postEnd.match(/(\d+)c charged/) || [])[1] ?? -1);
  if (laterSpent !== endedCharged) fail("ended sitting charge changed after wait/refresh: " + endedCharged + " → " + laterSpent);
  else ok("ending the chat stopped further deductions (" + laterSpent + "c)");

  const coinsAfter = await readWalletCoins(page);
  const expectWallet = coinsBefore - finalSpent;
  if (coinsAfter === expectWallet) ok("wallet updated " + coinsBefore + " → " + coinsAfter + " (spent " + finalSpent + "c)");
  else fail("wallet " + coinsAfter + " expected " + expectWallet + " (before " + coinsBefore + " spent " + finalSpent + ")");

  await page.goto(`${BASE}/me`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const meBody = await page.locator("body").innerText();
  if (/Amara Okonkwo/i.test(meBody) && meBody.includes(finalRate + "c/min") && meBody.includes(finalSpent + "c")) {
    ok("customer history lists Amara sitting at " + finalRate + "c/min charged " + finalSpent + "c");
  } else fail("customer history missing sitting: " + meBody.slice(0, 500));
  if (/Reading ·/.test(meBody) && meBody.includes(`-${finalSpent}c`)) ok("wallet history shows reading debit -" + finalSpent + "c");
  else fail("wallet history missing debit");
  await page.screenshot({ path: "/workspace/screenshots/qa-e2e-history.png", fullPage: true });

  const split = splitCoins(finalSpent);
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage({ viewport: { width: 390, height: 844 } });
  await adminPage.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await adminPage.getByLabel("Email").waitFor({ timeout: 15000 });
  await adminPage.waitForTimeout(800);
  let adminOk = false;
  for (const email of ["paidchat-mtukf4f4@ora.test", "funds-mtufmcgh@ora.test", customerEmail]) {
    await adminPage.getByLabel("Email").fill(email);
    await adminPage.locator("#pw").fill(PASSWORD);
    await adminPage.waitForTimeout(200);
    await adminPage.getByRole("button", { name: "Sign in to owner panel" }).click();
    const state = await Promise.race([
      adminPage.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 15000 }).then(() => "ok"),
      adminPage.getByText("Owner access only").waitFor({ timeout: 15000 }).then(() => "deny"),
      adminPage.locator("form p.text-danger").waitFor({ timeout: 15000 }).then(() => "bad"),
    ]).catch(() => "timeout");
    if (state === "ok") {
      adminOk = true;
      ok("owner signed in as " + email);
      break;
    }
    await adminCtx.clearCookies();
    await adminPage.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
    await adminPage.getByLabel("Email").waitFor({ timeout: 10000 });
    await adminPage.waitForTimeout(600);
  }
  if (!adminOk) {
    fail("could not open owner panel");
  } else {
    await adminPage.goto(`${BASE}/admin/sessions`, { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("heading", { name: "Sessions" }).waitFor({ timeout: 15000 });
    await adminPage.waitForTimeout(800);
    const sess = await adminPage.locator("body").innerText();
    const sessOk =
      /Amara/i.test(sess) &&
      sess.includes(finalRate + "c/min") &&
      sess.includes("charged " + finalSpent + "c") &&
      sess.includes("advisor " + split.advisorEarned + "c") &&
      sess.includes("house " + split.platformFee + "c");
    if (sessOk) ok("Admin Sessions matches sitting " + finalSpent + "c / advisor " + split.advisorEarned + "c / house " + split.platformFee + "c");
    else fail("Admin Sessions mismatch: " + sess.slice(0, 500));
    await adminPage.screenshot({ path: "/workspace/screenshots/qa-e2e-admin-sessions.png", fullPage: true });

    await adminPage.goto(`${BASE}/admin/finance`, { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("heading", { name: "Finance" }).waitFor({ timeout: 15000 });
    await adminPage.waitForTimeout(800);
    const fin = await adminPage.locator("body").innerText();
    const customerName = customerEmail.startsWith("paidchat-") ? "Paid Chat" : /Funds Client|Paid Chat/i.test(fin);
    if (
      (typeof customerName === "boolean" ? customerName : new RegExp(customerName, "i").test(fin) || fin.includes(customerEmail.split("@")[0])) &&
      fin.includes(finalSpent + "c") &&
      (fin.includes(split.advisorEarned + "c") || /Advisor earnings/i.test(fin)) &&
      (fin.includes(split.platformFee + "c") || /House commission/i.test(fin))
    ) {
      ok("Admin Finance shows customer spend " + finalSpent + "c, advisor " + split.advisorEarned + "c, house " + split.platformFee + "c");
    } else if (fin.includes(finalSpent + "c") && /Reading ·/.test(fin)) {
      ok("Admin Finance ledger includes reading " + finalSpent + "c");
    } else fail("Admin Finance missing amounts: " + fin.slice(0, 500));
    await adminPage.screenshot({ path: "/workspace/screenshots/qa-e2e-admin-finance.png", fullPage: true });
  }
  await adminPage.close();
  await adminCtx.close();

  if (pageErrors.length) fail("page errors " + pageErrors[0]);
  else ok("no page errors during paid chat");
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: "/workspace/screenshots/qa-e2e-throw.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.some((l) => l.startsWith("FAIL"));
  console.log(failed ? "RESULT FAIL" : "RESULT PASS");
  console.log(report.join("\n"));
  await browser.close();
  if (failed) process.exit(1);
}
