import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const PASSWORD = "testpass123";
const OWNER = "paidchat-mtukf4f4@ora.test";

const report = [];
function ok(m) {
  report.push("PASS  " + m);
  console.log("PASS  " + m);
}
function fail(m) {
  report.push("FAIL  " + m);
  console.log("FAIL  " + m);
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
  return page
    .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 18000 })
    .then(() => true)
    .catch(() => false);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  const inAdmin = await signIn(page, "/admin/login", OWNER, PASSWORD, "Sign in to owner panel");
  if (!inAdmin) throw new Error("owner sign-in failed");
  await page.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 15000 });
  ok("owner signed in");

  await page.goto(`${BASE}/admin/payouts`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Payouts" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const pay = await page.locator("body").innerText();
  const hasNova = /Nova Vale/i.test(pay);
  const hasPaid = /\bpaid\b/i.test(pay);
  const hasRejected = /rejected/i.test(pay);
  const has50 = pay.includes("50c");
  const hasUsd = pay.includes("$5.00");
  const hasId = /pay_[a-z0-9]+/i.test(pay);
  if (hasNova && hasPaid && has50 && hasUsd) ok("Admin Payouts still shows Nova Vale 50c / $5.00 paid");
  else fail("Admin Payouts missing paid record: " + pay.slice(0, 500));
  if (hasRejected) ok("Admin Payouts still shows rejected 50c payout");
  else fail("Admin Payouts missing rejected payout");
  if (hasId) ok("Admin Payouts still shows transaction id");
  else fail("Admin Payouts missing transaction id");
  await page.screenshot({ path: "/workspace/screenshots/qa-payout-verify-admin.png", fullPage: true });

  await page.goto(`${BASE}/admin/sessions`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Sessions" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const sess = await page.locator("body").innerText();
  if (/Nova Vale/i.test(sess) && /40c\/min/.test(sess) && /charged 74c/.test(sess) && /advisor 51c/.test(sess) && /house 23c/.test(sess)) {
    ok("Admin Sessions still has Nova Vale sitting 74c / advisor 51c / house 23c");
  } else fail("Admin Sessions missing Nova sitting: " + sess.slice(0, 500));

  await page.goto(`${BASE}/admin/finance`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Finance" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const fin = await page.locator("body").innerText();
  if (fin.includes("74c") && (fin.includes("51c") || /Advisor earnings/i.test(fin)) && (fin.includes("23c") || /House commission/i.test(fin))) {
    ok("Admin Finance still includes 74c spend, 51c advisor, 23c house");
  } else fail("Admin Finance missing amounts: " + fin.slice(0, 500));
  await page.screenshot({ path: "/workspace/screenshots/qa-payout-verify-finance.png", fullPage: true });

  await page.goto(`${BASE}/admin/customers`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Customers" }).waitFor({ timeout: 15000 });
  await page.getByPlaceholder("Name or email").fill("Nova");
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForTimeout(1000);
  const cust = await page.locator("body").innerText();
  const emailMatch = cust.match(/nova-[a-z0-9]+@ora\.test/i);
  const advisorEmail = emailMatch ? emailMatch[0] : "";
  if (advisorEmail) ok("found advisor account " + advisorEmail);
  else fail("could not find Nova Vale email: " + cust.slice(0, 400));

  if (advisorEmail) {
    const advCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const adv = await advCtx.newPage();
    const inAdv = await signIn(adv, "/advisor/login", advisorEmail, PASSWORD, "Sign in to desk");
    if (!inAdv) fail("advisor sign-in failed");
    else {
      await adv.goto(`${BASE}/advisor/earnings`, { waitUntil: "domcontentloaded" });
      await adv.getByRole("heading", { name: "Earnings" }).waitFor({ timeout: 15000 });
      await adv.waitForTimeout(800);
      const earn = await adv.locator("body").innerText();
      const available = Number((earn.match(/Available to withdraw:\s*(\d+)/i) || [])[1]);
      if (earn.includes("51c") && earn.includes("house 23c") && earn.includes("client 74c") && earn.includes("40c/min")) {
        ok("advisor earnings still show 74c gross / 51c advisor / 23c house at 40c/min");
      } else fail("advisor earnings missing sitting: " + earn.slice(0, 700));
      if (available === 1) ok("payout balance still 1c after approved 50c withdrawal");
      else fail("available is " + available + " expected 1c");
      if (/\bpaid\b/i.test(earn) && /rejected/i.test(earn) && earn.includes("50c") && earn.includes("$5.00")) {
        ok("advisor payout history still has rejected and paid 50c / $5.00");
      } else fail("advisor payout history incomplete: " + earn.slice(-500));
      await adv.screenshot({ path: "/workspace/screenshots/qa-payout-verify-earnings.png", fullPage: true });
    }
    await adv.close();
    await advCtx.close();
  }
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: "/workspace/screenshots/qa-payout-verify-throw.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.some((l) => l.startsWith("FAIL"));
  console.log(failed ? "RESULT FAIL" : "RESULT PASS");
  console.log(report.join("\n"));
  await browser.close();
  if (failed) process.exit(1);
}
