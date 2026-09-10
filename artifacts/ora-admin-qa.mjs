import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const owner = { name: "Owner Lane", email: `owner-${stamp}@ora.test`, password: "testpass123" };
const second = { name: "Client Two", email: `two-${stamp}@ora.test`, password: "testpass123" };

const report = [];
function ok(m) {
  report.push("OK  " + m);
  console.log("OK  " + m);
}
function fail(m) {
  report.push("FAIL " + m);
  console.log("FAIL " + m);
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

async function submitSignup(page) {
  await page.getByRole("button", { name: "Create account" }).click();
  try {
    await page.waitForURL("**/me", { timeout: 25000 });
  } catch (e) {
    const body = await page.locator("body").innerText();
    throw new Error("signup stayed on " + page.url() + " body=" + body.slice(0, 800));
  }
}

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function openAdmin(page, path, heading) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: heading }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  return page.locator("body").innerText();
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await paintSignup(page, owner);
  const nameVal = await page.getByLabel("Full name").inputValue();
  if (nameVal !== owner.name) throw new Error("signup fields reset name=" + nameVal);
  await submitSignup(page);
  ok("first account signed up");
  await page.waitForTimeout(800);
  const me = await page.locator("body").innerText();
  if (/Owner panel/i.test(me)) ok("You tab shows Owner panel");
  else fail("Owner panel link missing on first account: " + me.slice(0, 400));

  const overview = await openAdmin(page, "/admin", "Overview");
  await shot(page, "qa-admin-overview");
  if (/Customers/i.test(overview) && /House revenue/i.test(overview) && /Advisors/i.test(overview)) ok("overview stats render");
  else fail("overview incomplete: " + overview.slice(0, 500));
  if (/Owner access only/i.test(overview)) fail("first user denied owner access");

  await openAdmin(page, "/admin/settings", "Site settings");
  await page.getByLabel("Marketplace name").fill("Ora House");
  await page.getByLabel("House commission %").fill("25");
  await page.getByLabel("Support email").fill("support@ora.test");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.waitForTimeout(800);
  ok("settings saved");

  await openAdmin(page, "/admin/categories", "Categories");
  await page.getByPlaceholder("New category").fill("Tarot");
  await page.getByRole("button", { name: "Add" }).click();
  await page.waitForTimeout(800);
  const cats = await page.locator("body").innerText();
  if (/Tarot/.test(cats)) ok("category added");
  else fail("category missing: " + cats.slice(0, 300));

  await openAdmin(page, "/admin/promos", "Promotions");
  await page.getByLabel("First-login minutes").fill("4");
  await page.getByRole("button", { name: "Save defaults" }).click();
  await page.waitForTimeout(800);
  ok("welcome minutes saved");

  const fin = await openAdmin(page, "/admin/finance", "Finance");
  if (/Customer payments/i.test(fin) && /House commission/i.test(fin)) ok("finance page");
  else fail("finance missing: " + fin.slice(0, 400));

  const adv = await openAdmin(page, "/admin/advisors", "Advisors");
  if (/Applications/i.test(adv) && /On the floor/i.test(adv)) ok("advisors page");
  else fail("advisors missing: " + adv.slice(0, 400));

  const sess = await openAdmin(page, "/admin/sessions", "Sessions");
  if (/Active/i.test(sess) && /Records/i.test(sess)) ok("sessions page");
  else fail("sessions missing: " + sess.slice(0, 300));

  const pays = await openAdmin(page, "/admin/payouts", "Payouts");
  if (/Requested/i.test(pays) && /History/i.test(pays)) ok("payouts page");
  else fail("payouts missing: " + pays.slice(0, 300));

  const revs = await openAdmin(page, "/admin/reviews", "Reviews");
  if (/Hide a rating|No ratings/i.test(revs)) ok("reviews page");
  else fail("reviews missing: " + revs.slice(0, 300));

  const reps = await openAdmin(page, "/admin/reports", "Reports");
  if (/Customer spend/i.test(reps) && /Advisor earnings/i.test(reps)) ok("reports page");
  else fail("reports missing: " + reps.slice(0, 300));

  const custs = await openAdmin(page, "/admin/customers", "Customers");
  if (/Owner Lane/i.test(custs) || /owner/i.test(custs)) ok("customers list includes owner");
  else fail("customers empty: " + custs.slice(0, 300));

  const audit = await openAdmin(page, "/admin/audit", "Audit log");
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.waitForTimeout(800);
  await shot(page, "qa-admin-audit");
  const auditText = await page.locator("body").innerText();
  if (/Claimed owner|Saved settings|Added category/i.test(auditText + audit)) ok("audit log records owner actions");
  else fail("audit empty: " + auditText.slice(0, 500));

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage({ viewport: { width: 390, height: 844 } });
  await paintSignup(page2, second);
  await submitSignup(page2);
  ok("second account signed up");
  await page2.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(1000);
  await shot(page2, "qa-admin-denied");
  const denied = await page2.locator("body").innerText();
  if (/Owner access only/i.test(denied)) ok("second account denied owner panel");
  else fail("second account was not denied: " + denied.slice(0, 400));

  await page2.goto(BASE, { waitUntil: "domcontentloaded" });
  const home = await page2.locator("body").innerText();
  if (/Choose an advisor/i.test(home) || /Live now/i.test(home)) ok("customer home still works");
  else fail("home broken: " + home.slice(0, 300));
  await ctx2.close();
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
  await shot(page, "qa-admin-fail").catch(() => {});
} finally {
  console.log("\n---\n" + report.join("\n"));
  await browser.close();
  if (report.some((r) => r.startsWith("FAIL"))) process.exit(1);
}