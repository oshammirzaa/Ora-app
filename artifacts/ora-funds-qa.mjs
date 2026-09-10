import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Funds Client", email: `funds-${stamp}@ora.test`, password: "testpass123" };
const report = [];
function ok(m) {
  report.push("OK  " + m);
  console.log("OK  " + m);
}
function fail(m) {
  report.push("FAIL " + m);
  console.log("FAIL " + m);
}

function packButton(page, coins) {
  const prices = { 500: "$50.00", 1000: "$100.00", 2500: "$250.00", 5000: "$500.00" };
  return page.getByRole("button", { name: new RegExp(`${coins}c · \\${prices[coins]}`) });
}

function parseCoins(text) {
  const m = String(text).match(/COINS\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

async function walletCoins(page) {
  const body = await page.locator("body").innerText();
  return parseCoins(body);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (err) => {
  if (/Hydration failed/i.test(String(err))) return;
  pageErrors.push(String(err.stack || err));
});

try {
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name").waitFor();
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i += 1) {
    await fill(page, "Full name", customer.name);
    await fill(page, "Email", customer.email);
    await fill(page, "Password", customer.password);
    await fill(page, "Confirm password", customer.password);
    if ((await page.getByLabel("Email").inputValue()) === customer.email) break;
    await page.waitForTimeout(400);
  }
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/me", { timeout: 20000 });
  ok("signed up " + customer.email);

  await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Add funds" }).waitFor({ timeout: 15000 });
  await packButton(page, 500).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  for (const n of [500, 1000, 2500, 5000]) {
    if (!(await packButton(page, n).count())) fail("missing pack " + n);
  }
  if ((await packButton(page, 500).count()) && (await packButton(page, 5000).count())) {
    ok("packs 500 / 1000 / 2500 / 5000 shown");
  }
  const startCoins = (await walletCoins(page)) ?? 0;
  ok("starting coins " + startCoins);

  await packButton(page, 500).click();
  await page.getByText(/Test checkout/i).waitFor({ timeout: 15000 });
  const txLine = await page.getByText(/Transaction ID/i).innerText();
  const payId = (txLine.match(/pay_[a-z0-9]+/i) || [])[0];
  if (!payId) fail("checkout missing transaction id: " + txLine);
  else ok("checkout id " + payId);
  await page.screenshot({ path: "/workspace/screenshots/qa-funds-checkout.png", fullPage: true });

  const payBtn = page.getByRole("button", { name: /^Pay / });
  await payBtn.click();
  await payBtn.click().catch(() => {});
  await page.getByText(/Paid\./i).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  let coins = await walletCoins(page);
  if (coins !== startCoins + 500) fail("success did not credit 500: start=" + startCoins + " now=" + coins);
  else ok("successful pay credited +500 → " + coins);
  const paidBody = await page.locator("body").innerText();
  if (!payId || !paidBody.includes(payId)) fail("receipt missing transaction id");
  else ok("receipt shows " + payId);
  await page.screenshot({ path: "/workspace/screenshots/qa-funds-success.png", fullPage: true });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(/Paid\./i).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(700);
  const afterReload = await walletCoins(page);
  if (afterReload !== startCoins + 500) fail("refresh after success changed coins: " + afterReload);
  else ok("refresh after success kept " + afterReload + " coins");
  if (await page.getByRole("button", { name: /^Pay / }).count()) {
    await page.getByRole("button", { name: /^Pay / }).click();
    await page.waitForTimeout(1200);
  }
  const afterDup = await walletCoins(page);
  if (afterDup !== startCoins + 500) fail("duplicate confirmation credited again: " + afterDup);
  else ok("duplicate confirmation did not credit twice");

  await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Add funds" }).waitFor({ timeout: 10000 });
  await packButton(page, 500).waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  const hist = await page.locator("body").innerText();
  const successRows = [...hist.matchAll(/succeeded · pay_/gi)];
  if (successRows.length !== 1) fail("purchase history success count " + successRows.length);
  else ok("one successful purchase in wallet history");

  await packButton(page, 1000).click();
  await page.getByText(/Test checkout/i).waitFor({ timeout: 15000 });
  const failId = ((await page.getByText(/Transaction ID/i).innerText()).match(/pay_[a-z0-9]+/i) || [])[0];
  await page.getByRole("button", { name: "Simulate declined card" }).click();
  await page.getByText(/Card declined/i).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  const afterFail = await walletCoins(page);
  if (afterFail !== startCoins + 500) fail("declined card changed coins: " + afterFail);
  else ok("failed payment added 0 coins");
  await page.screenshot({ path: "/workspace/screenshots/qa-funds-failed.png", fullPage: true });

  await page.getByRole("button", { name: "Choose another pack" }).click();
  await packButton(page, 2500).waitFor({ timeout: 10000 });
  await packButton(page, 2500).click();
  await page.getByText(/Test checkout/i).waitFor({ timeout: 15000 });
  const cancelId = ((await page.getByText(/Transaction ID/i).innerText()).match(/pay_[a-z0-9]+/i) || [])[0];
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByText(/Payment cancelled/i).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  const afterCancel = await walletCoins(page);
  if (afterCancel !== startCoins + 500) fail("cancel changed coins: " + afterCancel);
  else ok("cancelled payment added 0 coins");
  await page.screenshot({ path: "/workspace/screenshots/qa-funds-cancelled.png", fullPage: true });

  await page.goto(`${BASE}/me`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const meBody = await page.locator("body").innerText();
  if (!/Purchase · 500c/i.test(meBody) && !/500c · \$50/i.test(meBody)) fail("You tab missing purchase: " + meBody.slice(0, 400));
  else ok("You tab shows 500c purchase");
  if (payId && meBody.includes(payId)) ok("You tab shows transaction id");
  if (failId && /failed/i.test(meBody)) ok("You tab lists failed checkout");
  if (cancelId && /cancelled/i.test(meBody)) ok("You tab lists cancelled checkout");
  await page.screenshot({ path: "/workspace/screenshots/qa-funds-history.png", fullPage: true });

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage({ viewport: { width: 390, height: 844 } });
  await adminPage.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await adminPage.getByLabel("Email").waitFor({ timeout: 15000 });
  await adminPage.waitForTimeout(800);
  const ownerEmails = ["funds-mtufmcgh@ora.test", customer.email];
  let adminOk = false;
  for (const email of ownerEmails) {
    await adminPage.getByLabel("Email").fill(email);
    await adminPage.locator("#pw").fill(customer.password);
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
    await adminPage.goto(`${BASE}/admin/finance`, { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("heading", { name: "Finance" }).waitFor({ timeout: 15000 });
    await adminPage.waitForTimeout(800);
    const fin = await adminPage.locator("body").innerText();
    if (/Funds Client/i.test(fin) || /funds-/i.test(fin) || fin.includes(customer.email)) {
      ok("admin finance lists Funds Client");
    } else fail("admin finance missing customer: " + fin.slice(0, 400));
    if (payId && fin.includes(payId)) ok("admin finance shows transaction " + payId);
    else if (/succeeded/i.test(fin) && /500c/.test(fin)) ok("admin finance shows 500c succeeded purchase");
    else fail("admin finance missing succeeded 500c purchase");
    await adminPage.screenshot({ path: "/workspace/screenshots/qa-funds-admin.png", fullPage: true });
  }
  await adminPage.close();
  await adminCtx.close();

  if (pageErrors.length) fail("page errors " + pageErrors[0]);
  else ok("no page errors");
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: "/workspace/screenshots/qa-funds-throw.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.some((l) => l.startsWith("FAIL"));
  console.log(failed ? "RESULT FAIL" : "RESULT PASS");
  console.log(report.join("\n"));
  await browser.close();
  if (failed) process.exit(1);
}
