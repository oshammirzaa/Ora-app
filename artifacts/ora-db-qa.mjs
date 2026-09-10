import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const owner = { name: "Owner Lane", email: `owner-${stamp}@ora.test`, password: "testpass123" };
const guest = { name: "Client Two", email: `guest-${stamp}@ora.test`, password: "testpass123" };

function ok(m) {
  console.log("OK  " + m);
}
function fail(m) {
  console.log("FAIL " + m);
  throw new Error(m);
}

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

async function paintSignup(page, person) {
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name").waitFor();
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) {
    await fill(page, "Full name", person.name);
    await fill(page, "Email", person.email);
    await fill(page, "Password", person.password);
    await fill(page, "Confirm password", person.password);
    const box = page.getByRole("checkbox");
    if (!(await box.isChecked())) await box.check();
    const nameVal = await page.getByLabel("Full name").inputValue();
    const emailVal = await page.getByLabel("Email").inputValue();
    const pwVal = await page.getByLabel("Password", { exact: true }).inputValue();
    if (nameVal === person.name && emailVal === person.email && pwVal === person.password) break;
    await page.waitForTimeout(400);
  }
}

async function submitSignup(page) {
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/me", { timeout: 25000 });
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await paintSignup(page, owner);
  await submitSignup(page);
  ok("first account signed up");

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 20000 });
  const body = (await page.locator("body").innerText()).toLowerCase();
  if (/owner access only/.test(body)) fail("first account denied owner access");
  ok("owner reached overview");

  for (const label of [
    "total customers",
    "total advisors",
    "advisors online now",
    "active live chats",
    "today's sales",
    "total house revenue",
    "pending payouts",
  ]) {
    if (!body.includes(label)) fail("missing overview card " + label);
  }
  ok("overview cards present");

  const advisorsMatch = body.match(/total advisors\s+(\d+)/i);
  const advisors = advisorsMatch ? Number(advisorsMatch[1]) : NaN;
  if (!(advisors >= 18)) fail("advisor total not from seed database: " + advisors + " body=" + body.slice(0, 500));
  ok("advisor total from database: " + advisors);

  await page.screenshot({ path: "/workspace/screenshots/qa-admin-db-overview.png", fullPage: true });

  const guestCtx = await browser.newContext();
  const guestPage = await guestCtx.newPage({ viewport: { width: 390, height: 844 } });
  await paintSignup(guestPage, guest);
  await submitSignup(guestPage);
  ok("second account signed up");
  await guestPage.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await guestPage.waitForTimeout(1500);
  const denied = (await guestPage.locator("body").innerText()).toLowerCase();
  if (!/owner access only|sign in|owner sign in/.test(denied)) {
    fail("second account was not blocked: " + denied.slice(0, 400));
  }
  ok("second account blocked from admin");
  await guestPage.screenshot({ path: "/workspace/screenshots/qa-admin-db-denied.png" });
  await guestCtx.close();

  console.log("PASS");
} catch (e) {
  await page.screenshot({ path: "/workspace/screenshots/qa-admin-db-fail.png", fullPage: true }).catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
