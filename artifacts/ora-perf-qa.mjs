import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Perf Client", email: `perf-${stamp}@ora.test`, password: "testpass123" };
const LIMIT_MS = 1800;

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

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function tapAndWait(page, click, wait, label) {
  const t0 = Date.now();
  await click();
  await wait();
  const ms = Date.now() - t0;
  if (ms <= LIMIT_MS) ok(`${label} responded in ${ms}ms`);
  else fail(`${label} slow ${ms}ms (limit ${LIMIT_MS})`);
  return ms;
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name").waitFor();
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i += 1) {
    await fill(page, "Full name", customer.name);
    await fill(page, "Email", customer.email);
    await fill(page, "Password", customer.password);
    await fill(page, "Confirm password", customer.password);
    const emailVal = await page.getByLabel("Email").inputValue();
    if (emailVal === customer.email) break;
    await page.waitForTimeout(400);
  }
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/me", { timeout: 20000 });
  ok("signed up");

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Chat now" }).first().waitFor({ timeout: 15000 });
  await page.locator("header").getByRole("link", { name: "Sign in" }).waitFor({ state: "detached", timeout: 15000 });
  await page.waitForTimeout(1500);
  const posts = [];
  page.on("request", (req) => {
    if (req.method() === "POST") posts.push(req.url());
  });
  const amara = page.locator("li").filter({ hasText: "Amara Okonkwo" }).getByRole("button", { name: "Chat now" });
  if (await amara.count()) {
    await amara.first().click({ force: true });
  } else {
    await page.getByRole("button", { name: "Chat now" }).first().click({ force: true });
  }
  try {
    await page.waitForURL(/\/(reading|wait)\//, { timeout: 20000 });
  } catch {
    throw new Error(
      "chat now url=" +
        page.url() +
        " posts=" +
        posts.join(",") +
        " body=" +
        (await page.locator("body").innerText()).slice(0, 400),
    );
  }
  ok("started chat at " + page.url());
  await page.waitForTimeout(2500);
  await shot(page, "qa-perf-chat");

  const inReading = page.url().includes("/reading/");
  if (inReading) {
    const clock1 = await page.locator(".text-5xl").first().innerText();
    await page.waitForTimeout(2200);
    const clock2 = await page.locator(".text-5xl").first().innerText();
    if (clock1 !== clock2) ok(`local timer advanced ${clock1} -> ${clock2}`);
    else fail(`timer stuck at ${clock1}`);
  }

  // Leave the live chat via the header mark (tabs are hidden in the room).
  await tapAndWait(
    page,
    () => page.locator("header a").first().click(),
    () => page.getByRole("heading", { name: /Choose an advisor/i }).waitFor({ timeout: 10000 }),
    "Home from live chat",
  );
  await shot(page, "qa-perf-home");

  await tapAndWait(
    page,
    () => page.getByRole("link", { name: "Wallet" }).click(),
    () => page.getByRole("heading", { name: /Wallet/i }).waitFor({ timeout: 10000 }),
    "Wallet tab",
  );
  await shot(page, "qa-perf-wallet");

  await tapAndWait(
    page,
    () => page.getByRole("link", { name: "Work" }).click(),
    () =>
      page.getByRole("heading", { name: /Desk|Apply/i }).waitFor({ timeout: 10000 }).catch(() =>
        page.getByText(/advisor/i).first().waitFor({ timeout: 8000 }),
      ),
    "Work tab",
  );
  await shot(page, "qa-perf-work");

  await page.locator("header a").first().click();
  await page.getByRole("heading", { name: /Choose an advisor/i }).waitFor({ timeout: 10000 });

  await tapAndWait(
    page,
    () => page.getByRole("link", { name: "You" }).click(),
    () => page.waitForURL("**/me", { timeout: 10000 }),
    "You tab",
  );
  await shot(page, "qa-perf-you");

  await tapAndWait(
    page,
    () => page.getByRole("link", { name: "Home" }).click(),
    () => page.getByRole("heading", { name: /Choose an advisor/i }).waitFor({ timeout: 10000 }),
    "Home tab return",
  );

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  if (errors.length) fail("page errors: " + errors.join(" | "));
  else ok("no page errors during nav");
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
  await shot(page, "qa-perf-error");
} finally {
  await browser.close();
}

const failed = report.filter((l) => l.startsWith("FAIL"));
console.log("\n" + (failed.length ? "RESULT FAIL" : "RESULT PASS"));
process.exit(failed.length ? 1 : 0);
