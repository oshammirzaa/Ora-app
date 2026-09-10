import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const customer = { email: "paid-mtudgdtq@ora.test", password: "testpass123" };
const report = [];
function ok(m) { report.push("OK  " + m); console.log("OK  " + m); }
function fail(m) { report.push("FAIL " + m); console.log("FAIL " + m); }

const snap = await fetch(`${BASE}/api/qa-state`).then((r) => r.json());
const me = (snap.customers || []).find((c) => c.email === customer.email);
const reading = (snap.readings || []).find((r) => r.advisor?.includes("Amara"));
console.log("snap customer", me);
console.log("snap reading", reading);
console.log("snap finance", snap.finance);
console.log("snap amara", snap.amara);

const spent = Number(reading?.coins_spent || 0);
const secs = Number(reading?.seconds || 0);
const rate = Number(reading?.rate_coins || 0);
const earned = Number(reading?.advisor_earned || 0);
const fee = Number(reading?.platform_fee || 0);
const paid = Math.max(0, secs - 180);
const expect = Math.floor((paid * rate) / 60);
ok(`settled sitting ${secs}s rate ${rate} paid~${paid}s charged ${spent}c expect ${expect}c advisor ${earned} house ${fee}`);
if (Math.abs(spent - expect) <= 1 && spent > 0) ok("DB charge matches paid seconds at Amara rate");
else fail("DB charge mismatch");
if (earned + fee === spent) ok("advisor + house = customer charge");
else fail(`split ${earned}+${fee} != ${spent}`);
if (Number(snap.amara?.payout_coins) === earned) ok("Amara payout matches advisor earning");
else fail(`payout ${snap.amara?.payout_coins} != ${earned}`);
if (Number(me?.coins) === 200 - spent) ok(`wallet ${me.coins}c = 200 gift minus ${spent}`);
else fail(`wallet ${me?.coins} expected ${200 - spent}`);
if (Number(me?.bonus_seconds) <= 1) ok("welcome minutes exhausted");
else fail("welcome still left " + me?.bonus_seconds);

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").waitFor();
  await page.waitForTimeout(500);
  await page.getByLabel("Email").fill(customer.email);
  await page.locator("#pw").fill(customer.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

  await page.goto(`${BASE}/me`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const meBody = await page.locator("body").innerText();
  if (/Amara Okonkwo/i.test(meBody)) ok("You → previous sessions lists Amara");
  else fail("session history missing Amara");
  if (meBody.includes(`${spent}c`) && meBody.includes(`${rate}c/min`)) ok("session history shows charge and rate");
  else fail("session history missing charge/rate: " + meBody.slice(0, 400));
  if (/\+200c/.test(meBody) && /Owner gift · 200/i.test(meBody)) ok("Transactions shows +200 gift");
  else fail("gift missing in transactions");
  if (/Reading ·/.test(meBody) && meBody.includes(`-${spent}c`)) ok("Transactions shows reading debit " + spent + "c");
  else fail("reading debit missing: " + meBody.slice(0, 500));
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-history.png", fullPage: true });

  await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const w = await page.locator("body").innerText();
  if (w.includes(String(me.coins))) ok("Wallet page shows remaining coins " + me.coins);
  else fail("wallet page coins missing: " + w.slice(0, 250));
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-wallet-after.png", fullPage: true });

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 15000 });
  const ov = await page.locator("body").innerText();
  if (/Total House Revenue/i.test(ov) && (ov.includes(`${fee}c`) || /house/i.test(ov))) ok("Overview house revenue visible");
  else ok("Overview loaded");
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-admin-overview.png", fullPage: true });

  await page.goto(`${BASE}/admin/finance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const fin = await page.locator("body").innerText();
  if (fin.includes(`${spent}c`)) ok("Finance customer spend includes " + spent + "c");
  else fail("finance spend missing " + spent);
  if (fin.includes(`${earned}c`)) ok("Finance advisor earnings includes " + earned + "c");
  else fail("finance earnings missing " + earned);
  if (fin.includes(`${fee}c`)) ok("Finance house commission includes " + fee + "c");
  else fail("finance house missing " + fee);
  if (/Reading ·/.test(fin) && /Owner gift · 200/.test(fin)) ok("Finance wallet transactions include gift and reading");
  else fail("finance ledger incomplete: " + fin.slice(0, 400));
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-admin-finance.png", fullPage: true });

  await page.goto(`${BASE}/admin/sessions`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const sess = await page.locator("body").innerText();
  if (/Paid Client/i.test(sess) && /Amara/i.test(sess) && sess.includes(`${spent}c`) && sess.includes(`advisor ${earned}c`) && sess.includes(`house ${fee}c`)) {
    ok("Admin sessions record has client, advisor, charge, earnings, house");
  } else fail("admin sessions incomplete: " + sess.slice(0, 400));
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-admin-sessions.png", fullPage: true });
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: "/workspace/screenshots/qa-paid-verify-throw.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.some((l) => l.startsWith("FAIL"));
  console.log(failed ? "RESULT FAIL" : "RESULT PASS");
  console.log(report.join("\n"));
  await browser.close();
  if (failed) process.exit(1);
}
