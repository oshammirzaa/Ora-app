import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const PASSWORD = "testpass123";
const existingCustomer = { name: "Paid Chat", email: "paidchat-mtukf4f4@ora.test", password: PASSWORD };
const freshCustomer = { name: "Paid Chat", email: `paidchat-${stamp}@ora.test`, password: PASSWORD };
const ADVISOR = {
  legal: "Nova Vale",
  name: "Nova Vale",
  email: `nova-${stamp}@ora.test`,
  password: PASSWORD,
};
const RATE = 40;
const PAYOUT = 50;
const TARGET_GROSS = 72;

const report = [];
function ok(m) {
  report.push("PASS  " + m);
  console.log("PASS  " + m);
}
function fail(m) {
  report.push("FAIL  " + m);
  console.log("FAIL  " + m);
}

function splitCoins(coins) {
  const c = Math.max(0, Math.floor(coins));
  const advisorEarned = Math.floor((c * 70) / 100);
  return { advisorEarned, platformFee: c - advisorEarned };
}

function parseClock(text) {
  const m = String(text || "").match(/(\d+):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

async function signIn(page, path, email, password, submitName) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await fill(page, "Email", email);
  await page.locator("#pw").fill(password);
  await page.getByRole("button", { name: submitName }).click();
  const reached = await page
    .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 18000 })
    .then(() => true)
    .catch(() => false);
  return reached && !page.url().includes("/login");
}

async function signUpCustomer(page, person) {
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name").waitFor({ timeout: 15000 });
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

async function liveCharged(page) {
  const body = await page.locator("body").innerText();
  const charged = Number((body.match(/(\d+)c charged/i) || [])[1]);
  const rate = Number((body.match(/(\d+)c\s*\/\s*min/i) || [])[1]);
  const clock = parseClock(body);
  return { charged: Number.isFinite(charged) ? charged : 0, rate, clock };
}

function parseAvailable(text) {
  const m = String(text || "").match(/Available to withdraw:\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const advCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const adminCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const cust = await custCtx.newPage();
const adv = await advCtx.newPage();
const admin = await adminCtx.newPage();
const pageErrors = [];
for (const p of [cust, adv, admin]) {
  p.on("pageerror", (err) => {
    if (/Hydration failed/i.test(String(err))) return;
    pageErrors.push(String(err.stack || err));
  });
}

let gross = 0;
let earned = 0;
let fee = 0;
let payoutId = "";
let customerEmail = existingCustomer.email;

try {
  let inApp = await signIn(cust, "/login", existingCustomer.email, existingCustomer.password, "Sign in");
  if (!inApp) {
    customerEmail = freshCustomer.email;
    await signUpCustomer(cust, freshCustomer);
    ok("signed up customer " + customerEmail);
  } else {
    ok("customer signed in " + customerEmail);
  }

  await cust.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
  await cust.getByRole("heading", { name: "Wallet" }).waitFor({ timeout: 15000 });
  await cust.waitForTimeout(600);
  let walletBefore = Number(((await cust.locator("body").innerText()).match(/COINS\s+(\d+)/i) || [])[1] || 0);
  if (walletBefore < TARGET_GROSS + 10) {
    await buyPack500(cust);
    await cust.waitForTimeout(800);
    walletBefore = Number(((await cust.locator("body").innerText()).match(/COINS\s+(\d+)/i) || [])[1] || 0);
  }
  if (walletBefore >= TARGET_GROSS + 10) ok("customer wallet has purchased coins: " + walletBefore);
  else fail("customer wallet too low: " + walletBefore);

  await adv.goto(`${BASE}/advisor/signup`, { waitUntil: "networkidle" });
  await adv.getByLabel("Full name").waitFor({ timeout: 15000 });
  await adv.waitForTimeout(800);
  await adv.locator("#legal").fill(ADVISOR.legal);
  await adv.locator("#disp").fill(ADVISOR.name);
  await adv.locator("#email").fill(ADVISOR.email);
  await adv.locator("#pw").fill(ADVISOR.password);
  await adv.locator("#pw2").fill(ADVISOR.password);
  await adv.locator("#bio").fill("I read timing, love, and the quiet patterns people miss in a sitting.");
  await adv.locator("#ex").fill("12 years of private readings.");
  await adv.locator("#sp").fill("Love, Tarot");
  await adv.locator("#yr").fill("12");
  await adv.locator("#rate").fill(String(RATE));
  await adv.locator("#lang").fill("English");
  await adv.locator("#photo").setInputFiles("/workspace/public/images/lila.jpg");
  await adv.waitForTimeout(1200);
  await adv.getByRole("checkbox").check();
  await adv.getByRole("button", { name: "Submit application" }).click();
  await adv.getByText(/pending verification/i).waitFor({ timeout: 25000 });
  ok("advisor application submitted");

  if (!(await signIn(admin, "/admin/login", customerEmail, PASSWORD, "Sign in to owner panel"))) {
    throw new Error("owner sign-in failed as " + customerEmail);
  }
  await admin.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 15000 });
  ok("owner signed in as " + customerEmail);
  await admin.goto(`${BASE}/admin/advisors`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Advisors" }).waitFor({ timeout: 15000 });
  const appRow = admin.locator("li").filter({ hasText: ADVISOR.name });
  await appRow.getByRole("button", { name: "Approve" }).click();
  await admin.waitForTimeout(1500);
  ok("owner approved " + ADVISOR.name);

  await adv.goto(`${BASE}/advisor`, { waitUntil: "domcontentloaded" });
  await adv.waitForTimeout(1200);
  const offline = adv.getByRole("button", { name: "Offline" });
  if (await offline.count()) {
    await offline.click();
    await adv.waitForTimeout(1200);
  }
  const online = await adv.getByRole("button", { name: "Online" }).count();
  if (online) ok("advisor is online");
  else fail("advisor did not go online: " + (await adv.locator("body").innerText()).slice(0, 300));

  let found = false;
  for (let i = 0; i < 8 && !found; i += 1) {
    await cust.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await cust.waitForTimeout(1200);
    found = (await cust.getByText(ADVISOR.name, { exact: true }).count()) > 0;
    if (!found) await cust.reload({ waitUntil: "domcontentloaded" });
  }
  if (found) ok("customer sees " + ADVISOR.name + " on the floor");
  else fail("customer cannot find " + ADVISOR.name);

  const card = cust.locator("li").filter({ hasText: ADVISOR.name }).first();
  await card.getByRole("button", { name: "Chat now" }).click({ force: true });
  await cust.waitForURL(/\/(wait|reading)\//, { timeout: 25000 });
  if (/\/wait\//.test(cust.url())) ok("customer waiting for advisor to accept");
  else ok("customer entered live chat without wait: " + cust.url());

  await adv.goto(`${BASE}/advisor`, { waitUntil: "domcontentloaded" });
  await adv.getByRole("button", { name: "Accept" }).waitFor({ timeout: 20000 });
  await adv.getByRole("button", { name: "Accept" }).click();
  await adv.waitForURL(/\/advisor\/session\//, { timeout: 20000 });
  ok("advisor accepted paid chat");

  await cust.waitForURL(/\/reading\//, { timeout: 25000 });
  await cust.locator(".text-5xl").first().waitFor({ timeout: 15000 });
  const start = await liveCharged(cust);
  if (start.rate === RATE) ok("live chat uses " + RATE + "c/min");
  else fail("live rate " + start.rate + " expected " + RATE);

  const chip = cust.getByRole("button", { name: /A relationship I can't read/i });
  if (await chip.count()) {
    await chip.click();
    await cust.waitForTimeout(2000);
  }

  console.log("waiting through included minutes then paid time to " + TARGET_GROSS + "c...");
  const paidStart = Date.now();
  let live = start;
  while (Date.now() - paidStart < 400_000) {
    live = await liveCharged(cust);
    if (live.charged >= TARGET_GROSS) break;
    await cust.waitForTimeout(2500);
  }
  if (live.charged >= TARGET_GROSS) ok("paid time reached " + live.charged + "c charged (clock " + live.clock + "s)");
  else fail("did not reach " + TARGET_GROSS + "c charged, got " + live.charged + " at " + live.clock + "s");

  await cust.getByRole("button", { name: "End reading" }).click();
  await cust.getByText(/This reading ended/i).waitFor({ timeout: 15000 });
  await cust.waitForTimeout(1200);
  const endedBody = await cust.locator("body").innerText();
  gross = Number((endedBody.match(/(\d+)c charged/) || [])[1] || live.charged);
  const endedRate = Number((endedBody.match(/(\d+)c\s*\/\s*min/) || [])[1] || RATE);
  const split = splitCoins(gross);
  earned = split.advisorEarned;
  fee = split.platformFee;
  if (endedRate === RATE) ok("ended sitting billed at " + RATE + "c/min");
  else fail("ended rate " + endedRate);
  if (gross >= TARGET_GROSS) ok("gross client spend " + gross + "c (advisor " + earned + "c house " + fee + "c)");
  else fail("gross too low " + gross);
  await cust.screenshot({ path: "/workspace/screenshots/qa-payout-ended.png", fullPage: true });

  await cust.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
  await cust.waitForTimeout(800);
  const walletAfter = Number(((await cust.locator("body").innerText()).match(/COINS\s+(\d+)/i) || [])[1] || 0);
  if (walletAfter === walletBefore - gross) ok("customer wallet " + walletBefore + " → " + walletAfter);
  else fail("wallet " + walletAfter + " expected " + (walletBefore - gross));

  await adv.goto(`${BASE}/advisor/earnings`, { waitUntil: "domcontentloaded" });
  await adv.getByRole("heading", { name: "Earnings" }).waitFor({ timeout: 15000 });
  await adv.waitForTimeout(1000);
  let earnBody = await adv.locator("body").innerText();
  const availableBefore = parseAvailable(earnBody);
  const today = Number((earnBody.match(/TODAY\s+(\d+)c/i) || [])[1]);
  const allTime = Number((earnBody.match(/ALL TIME\s+(\d+)c/i) || [])[1]);
  if (earnBody.includes(`${earned}c`) && earnBody.includes(`house ${fee}c`) && earnBody.includes(`client ${gross}c`)) {
    ok("advisor session shows gross " + gross + "c, advisor " + earned + "c, house " + fee + "c");
  } else fail("advisor session amounts missing: " + earnBody.slice(0, 700));
  if (earnBody.includes(RATE + "c/min")) ok("advisor session uses " + RATE + "c/min");
  else fail("advisor session rate missing");
  if (availableBefore === earned) ok("available balance equals advisor share " + earned + "c");
  else fail("available " + availableBefore + " expected " + earned);
  if (today === earned && allTime === earned) ok("today and all-time match advisor share " + earned + "c");
  else fail("today " + today + " all-time " + allTime + " expected " + earned);
  if (/You keep 70%/.test(earnBody) && /house keeps 30%/.test(earnBody)) ok("dashboard shows 70/30 split");
  else fail("split copy missing");
  await adv.screenshot({ path: "/workspace/screenshots/qa-payout-earnings.png", fullPage: true });

  await adv.getByRole("link", { name: "Desk" }).click();
  await adv.waitForTimeout(800);
  await adv.getByRole("link", { name: "Earnings" }).click();
  await adv.getByRole("heading", { name: "Earnings" }).waitFor({ timeout: 15000 });
  await adv.waitForTimeout(800);
  earnBody = await adv.locator("body").innerText();
  if (parseAvailable(earnBody) === earned && earnBody.includes(`${earned}c`)) ok("earnings persisted after tab navigation");
  else fail("earnings lost after tab navigation");
  await adv.reload({ waitUntil: "domcontentloaded" });
  await adv.getByRole("heading", { name: "Earnings" }).waitFor({ timeout: 15000 });
  await adv.waitForTimeout(800);
  earnBody = await adv.locator("body").innerText();
  if (parseAvailable(earnBody) === earned) ok("earnings persisted after refresh");
  else fail("earnings lost after refresh: " + parseAvailable(earnBody));

  if (earned < PAYOUT) fail("earned " + earned + "c is below payout minimum " + PAYOUT);
  await adv.locator("#c").fill(String(PAYOUT));
  await adv.getByRole("button", { name: "Request payout" }).click();
  await adv.getByText(/Payout requested|requested/i).first().waitFor({ timeout: 15000 });
  await adv.waitForTimeout(1000);
  earnBody = await adv.locator("body").innerText();
  const afterReq = parseAvailable(earnBody);
  if (afterReq === earned - PAYOUT) ok("request deducted " + PAYOUT + "c from available (" + earned + " → " + afterReq + ")");
  else fail("available after request " + afterReq + " expected " + (earned - PAYOUT));
  if (earnBody.includes(`${PAYOUT}c`) && earnBody.includes("$5.00") && /requested/i.test(earnBody)) {
    ok("advisor payout list shows " + PAYOUT + "c · $5.00 requested");
  } else fail("advisor payout row missing: " + earnBody.slice(-400));
  const idMatch = earnBody.match(/pay_[a-z0-9]+/i);
  payoutId = idMatch ? idMatch[0] : "";
  if (payoutId) ok("payout has transaction id " + payoutId);
  else fail("payout id missing on advisor earnings");

  await adv.getByRole("button", { name: "Request payout" }).click();
  await adv.waitForTimeout(1500);
  const dupBody = await adv.locator("body").innerText();
  const afterDup = parseAvailable(dupBody);
  if (afterDup === earned - PAYOUT) ok("duplicate payout request did not deduct again (" + afterDup + "c available)");
  else fail("duplicate request changed available " + afterDup);

  await admin.goto(`${BASE}/admin/payouts`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Payouts" }).waitFor({ timeout: 15000 });
  await admin.waitForTimeout(800);
  let payBody = await admin.locator("body").innerText();
  const adminHas =
    payBody.includes(ADVISOR.name) &&
    payBody.includes(PAYOUT + "c") &&
    payBody.includes("$5.00") &&
    /requested/i.test(payBody);
  if (adminHas) ok("Admin Payouts shows " + ADVISOR.name + " · " + PAYOUT + "c · $5.00 requested");
  else fail("Admin Payouts missing request: " + payBody.slice(0, 600));
  if (payoutId && payBody.includes(payoutId)) ok("Admin Payouts shows transaction id " + payoutId);
  else if (/pay_/i.test(payBody)) ok("Admin Payouts shows a payout id");
  else fail("Admin Payouts missing transaction id");
  await admin.screenshot({ path: "/workspace/screenshots/qa-payout-admin-requested.png", fullPage: true });

  await admin.getByRole("link", { name: "Overview" }).first().click().catch(async () => {
    await admin.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  });
  await admin.waitForTimeout(800);
  await admin.goto(`${BASE}/admin/payouts`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Payouts" }).waitFor({ timeout: 15000 });
  await admin.waitForTimeout(600);
  payBody = await admin.locator("body").innerText();
  if (payBody.includes(ADVISOR.name) && /requested/i.test(payBody)) ok("admin payout persisted after navigation");
  else fail("admin payout lost after navigation");
  await admin.reload({ waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Payouts" }).waitFor({ timeout: 15000 });
  await admin.waitForTimeout(600);
  payBody = await admin.locator("body").innerText();
  if (payBody.includes(ADVISOR.name) && /requested/i.test(payBody)) ok("admin payout persisted after refresh");
  else fail("admin payout lost after refresh");

  const rejectBtn = admin.getByRole("button", { name: "Reject" }).first();
  await rejectBtn.click();
  await admin.getByText(/Rejected|already decided/i).first().waitFor({ timeout: 15000 });
  await admin.waitForTimeout(800);
  if (await admin.getByRole("button", { name: "Reject" }).count()) {
    await admin.getByRole("button", { name: "Reject" }).first().click();
    await admin.waitForTimeout(1000);
  }
  payBody = await admin.locator("body").innerText();
  if (/rejected/i.test(payBody) && payBody.includes(PAYOUT + "c")) ok("Admin Reject marked payout rejected");
  else fail("reject did not update status: " + payBody.slice(0, 400));
  await admin.screenshot({ path: "/workspace/screenshots/qa-payout-admin-rejected.png", fullPage: true });

  await adv.reload({ waitUntil: "domcontentloaded" });
  await adv.getByRole("heading", { name: "Earnings" }).waitFor({ timeout: 15000 });
  await adv.waitForTimeout(800);
  earnBody = await adv.locator("body").innerText();
  const afterReject = parseAvailable(earnBody);
  if (afterReject === earned) ok("reject returned " + PAYOUT + "c to available (" + afterReject + "c)");
  else fail("available after reject " + afterReject + " expected " + earned);
  if (/rejected/i.test(earnBody)) ok("advisor payout history shows rejected");
  else fail("advisor history missing rejected");

  await adv.locator("#c").fill(String(PAYOUT));
  await adv.getByRole("button", { name: "Request payout" }).click();
  await adv.waitForTimeout(1500);
  earnBody = await adv.locator("body").innerText();
  const afterReq2 = parseAvailable(earnBody);
  if (afterReq2 === earned - PAYOUT) ok("second request deducted " + PAYOUT + "c (" + afterReq2 + "c left)");
  else fail("available after second request " + afterReq2);

  await admin.reload({ waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Payouts" }).waitFor({ timeout: 15000 });
  await admin.waitForTimeout(800);
  const approveBtn = admin.getByRole("button", { name: "Approve" }).first();
  await approveBtn.click();
  await admin.getByText(/Marked paid|already decided/i).first().waitFor({ timeout: 15000 });
  await admin.waitForTimeout(800);
  if (await admin.getByRole("button", { name: "Approve" }).count()) {
    await admin.getByRole("button", { name: "Approve" }).first().click();
    await admin.waitForTimeout(1000);
  }
  payBody = await admin.locator("body").innerText();
  if (/paid/i.test(payBody) && payBody.includes(ADVISOR.name) && payBody.includes(PAYOUT + "c")) {
    ok("Admin Approve marked payout paid for " + ADVISOR.name);
  } else fail("approve did not mark paid: " + payBody.slice(0, 500));
  const requestedLeft = admin.getByRole("button", { name: "Approve" });
  if ((await requestedLeft.count()) === 0) ok("no second approve button after paid (no duplicate payment)");
  else fail("approve still available after paid");
  await admin.screenshot({ path: "/workspace/screenshots/qa-payout-admin-paid.png", fullPage: true });

  await adv.reload({ waitUntil: "domcontentloaded" });
  await adv.getByRole("heading", { name: "Earnings" }).waitFor({ timeout: 15000 });
  await adv.waitForTimeout(800);
  earnBody = await adv.locator("body").innerText();
  const afterPay = parseAvailable(earnBody);
  if (afterPay === earned - PAYOUT) ok("approve did not return coins (available " + afterPay + "c)");
  else fail("available after approve " + afterPay + " expected " + (earned - PAYOUT));
  if (/\bpaid\b/i.test(earnBody) && /rejected/i.test(earnBody)) ok("advisor payout history keeps rejected and paid");
  else fail("advisor payout history incomplete: " + earnBody.slice(-400));

  await adv.locator("#c").fill(String(PAYOUT));
  await adv.getByRole("button", { name: "Request payout" }).click();
  await adv.waitForTimeout(1500);
  earnBody = await adv.locator("body").innerText();
  const afterOver = parseAvailable(earnBody);
  if (afterOver === earned - PAYOUT) ok("over-request did not deduct again (available still " + afterOver + "c)");
  else fail("over-request changed available to " + afterOver);

  await admin.goto(`${BASE}/admin/sessions`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Sessions" }).waitFor({ timeout: 15000 });
  await admin.waitForTimeout(800);
  const sess = await admin.locator("body").innerText();
  if (
    sess.includes(ADVISOR.name) &&
    sess.includes(RATE + "c/min") &&
    sess.includes("charged " + gross + "c") &&
    sess.includes("advisor " + earned + "c") &&
    sess.includes("house " + fee + "c")
  ) {
    ok("Admin Sessions matches sitting " + gross + "c / advisor " + earned + "c / house " + fee + "c");
  } else fail("Admin Sessions mismatch: " + sess.slice(0, 500));

  await admin.goto(`${BASE}/admin/finance`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Finance" }).waitFor({ timeout: 15000 });
  await admin.waitForTimeout(800);
  const fin = await admin.locator("body").innerText();
  if (fin.includes(gross + "c") && (fin.includes(earned + "c") || /Advisor earnings/i.test(fin))) {
    ok("Admin Finance includes sitting spend " + gross + "c and advisor " + earned + "c");
  } else fail("Admin Finance missing sitting: " + fin.slice(0, 400));

  if (pageErrors.length) fail("page errors " + pageErrors[0]);
  else ok("no page errors during earnings/payout flow");
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
  await cust.screenshot({ path: "/workspace/screenshots/qa-payout-cust-throw.png", fullPage: true }).catch(() => {});
  await adv.screenshot({ path: "/workspace/screenshots/qa-payout-adv-throw.png", fullPage: true }).catch(() => {});
  await admin.screenshot({ path: "/workspace/screenshots/qa-payout-admin-throw.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.some((l) => l.startsWith("FAIL"));
  console.log(failed ? "RESULT FAIL" : "RESULT PASS");
  console.log(report.join("\n"));
  await browser.close();
  if (failed) process.exit(1);
}
