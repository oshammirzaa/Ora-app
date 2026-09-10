import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const owner = { name: "Owner Lane", email: `owner-${stamp}@ora.test`, password: "testpass123" };

const PRIMARY = [
  { path: "/admin", label: "Overview" },
  { path: "/admin/advisors", label: "Advisors" },
  { path: "/admin/customers", label: "Customers" },
  { path: "/admin/sessions", label: "Sessions" },
  { path: "/admin/finance", label: "Finance" },
  { path: "/admin/payouts", label: "Payouts" },
  { path: "/admin/reports", label: "Reports" },
  { path: "/admin/settings", label: "Settings" },
];

const STATS = [
  "Total Customers",
  "Total Advisors",
  "Advisors Online Now",
  "Active Live Chats",
  "Today's Sales",
  "Total House Revenue",
  "Pending Payouts",
];

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
  await page.waitForTimeout(1200);
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

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await paintSignup(page, owner);
  const nameVal = await page.getByLabel("Full name").inputValue();
  if (nameVal !== owner.name) fail("signup fields reset name=" + nameVal);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/me", { timeout: 25000 });
  ok("first account signed up");

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 20000 });
  if (/Owner access only/i.test(await page.locator("body").innerText())) {
    fail("first user denied owner access");
  }
  ok("overview heading");

  const aside = page.locator("aside");
  await aside.waitFor();
  for (const n of PRIMARY) {
    const link = aside.getByRole("link", { name: n.label, exact: true });
    if (!(await link.isVisible())) fail("desktop sidebar missing " + n.label);
  }
  ok("desktop sidebar has 8 primary links");

  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const s of STATS) {
    if (!body.includes(s.toLowerCase())) fail("missing overview stat: " + s);
  }
  ok("overview stats present");

  await page.screenshot({ path: "/workspace/screenshots/qa-admin-ui-desktop.png", fullPage: true });
  ok("desktop screenshot");

  for (const n of PRIMARY) {
    await aside.getByRole("link", { name: n.label, exact: true }).click();
    await page.getByRole("heading", { name: n.label }).waitFor({ timeout: 15000 });
    if (!page.url().includes(n.path === "/admin" ? "/admin" : n.path)) {
      fail("nav " + n.label + " landed on " + page.url());
    }
    ok("desktop nav " + n.label);
  }

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 15000 });
  await page.getByRole("link", { name: /Total Customers/i }).first().click();
  await page.getByRole("heading", { name: "Customers" }).waitFor({ timeout: 15000 });
  ok("stat card opens Customers");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-admin-ui-mobile.png", fullPage: true });
  ok("mobile overview screenshot");

  await page.getByRole("button", { name: "Open menu" }).click();
  for (const n of PRIMARY) {
    const link = aside.getByRole("link", { name: n.label, exact: true });
    if (!(await link.isVisible())) fail("mobile menu missing " + n.label);
  }
  ok("mobile menu has 8 primary links");

  await aside.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Settings" }).waitFor({ timeout: 15000 });
  ok("mobile Settings navigates");

  await page.getByRole("button", { name: "Open menu" }).click();
  await aside.getByRole("link", { name: "Advisors", exact: true }).click();
  await page.getByRole("heading", { name: "Advisors" }).waitFor({ timeout: 15000 });
  ok("mobile Advisors navigates");

  await page.screenshot({ path: "/workspace/screenshots/qa-admin-ui-mobile-advisors.png", fullPage: true });
  console.log("PASS");
} catch (e) {
  await page.screenshot({ path: "/workspace/screenshots/qa-admin-ui-fail.png", fullPage: true }).catch(() => {});
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
