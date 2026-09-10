import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Client Quinn", email: `c-${stamp}@ora.test`, password: "testpass123" };
const advisor = {
  legal: "Amara Desk",
  name: "Amara Desk",
  email: `a-${stamp}@ora.test`,
  password: "testpass123",
};

const report = [];
function ok(m) { report.push("OK  " + m); console.log("OK  " + m); }
function fail(m) { report.push("FAIL " + m); console.log("FAIL " + m); }

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const cust = await browser.newPage({ viewport: { width: 390, height: 844 } });
const adv = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await cust.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await cust.getByLabel("Full name").waitFor();
  await cust.waitForTimeout(800);
  await fill(cust, "Full name", customer.name);
  await fill(cust, "Email", customer.email);
  await fill(cust, "Password", customer.password);
  await fill(cust, "Confirm password", customer.password);
  await cust.getByRole("checkbox").check();
  await cust.waitForTimeout(200);
  const nameVal = await cust.getByLabel("Full name").inputValue();
  if (nameVal !== customer.name) throw new Error("signup fields reset name=" + nameVal);
  await cust.getByRole("button", { name: "Create account" }).click();
  await cust.waitForURL("**/me", { timeout: 20000 });
  ok("customer signed up");

  await cust.goto(BASE, { waitUntil: "domcontentloaded" });
  await cust.getByRole("button", { name: "Chat now" }).first().waitFor();
  await cust.waitForTimeout(1500);
  await cust.getByRole("button", { name: "Chat now" }).first().click();
  try {
    await cust.waitForURL("**/reading/**", { timeout: 15000 });
  } catch (e) {
    throw new Error("chat now url=" + cust.url() + " body=" + (await cust.locator("body").innerText()).slice(0, 500));
  }
  await cust.waitForTimeout(2500);
  await shot(cust, "qa-billing-live");
  const body = await cust.locator("body").innerText();
  if (/charged/i.test(body) && /min/.test(body)) ok("live reading shows elapsed cost and rate");
  else fail("missing cost/rate on live reading: " + body.slice(0, 400));
  if (/Included left|paid time left|charged/i.test(body)) ok("wallet remaining shown");
  else fail("no remaining time copy");

  const clock1 = await cust.locator(".text-5xl").first().innerText();
  await cust.waitForTimeout(4500);
  const clock2 = await cust.locator(".text-5xl").first().innerText();
  if (clock1 !== clock2) ok(`timer advanced ${clock1} -> ${clock2}`);
  else fail(`timer stuck at ${clock1}`);

  await cust.getByRole("button", { name: "End reading" }).click();
  await cust.waitForTimeout(1200);
  await shot(cust, "qa-billing-ended");
  const ended = await cust.locator("body").innerText();
  if (/ended/i.test(ended) && /charged/i.test(ended)) ok("ended summary shows charge");
  else fail("ended summary missing: " + ended.slice(0, 300));
  if (/Rate this reading/i.test(ended)) ok("review form after end");
  else fail("no review form");

  await adv.goto(`${BASE}/advisor/signup`, { waitUntil: "networkidle" });
  await adv.getByLabel("Full name").waitFor();
  await adv.waitForTimeout(800);
  await adv.locator("#legal").fill(advisor.legal);
  await adv.locator("#disp").fill(advisor.name);
  await adv.locator("#email").fill(advisor.email);
  await adv.locator("#pw").fill(advisor.password);
  await adv.locator("#pw2").fill(advisor.password);
  await fill(adv, "Bio / about me", "I read love and timing with a quiet room and a sharp eye for patterns.");
  await fill(adv, "Experience", "10 years of private sittings.");
  await fill(adv, "Specialties", "Love, Tarot");
  await fill(adv, "Years", "10");
  await fill(adv, "Coins / min", "20");
  await fill(adv, "Languages", "English");
  await adv.locator("#photo").setInputFiles("/workspace/public/images/amara.jpg");
  await adv.waitForTimeout(1500);
  await adv.getByRole("checkbox").check();
  await adv.getByRole("button", { name: "Submit application" }).click();
  await adv.getByText(/pending verification|in review/i).first().waitFor({ timeout: 25000 });
  ok("advisor pending");

  await cust.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await cust.getByRole("heading", { name: "Owner panel" }).waitFor({ timeout: 15000 });
  await cust.getByRole("button", { name: "Approve" }).first().click();
  await cust.waitForTimeout(1500);
  ok("approved advisor");

  await adv.goto(`${BASE}/advisor`, { waitUntil: "domcontentloaded" });
  await adv.getByRole("button", { name: "Offline" }).click();
  await adv.getByRole("button", { name: "Online" }).waitFor({ timeout: 8000 });
  ok("advisor online");

  await cust.goto(BASE, { waitUntil: "domcontentloaded" });
  await cust.waitForTimeout(9000);
  const card = cust.locator("li", { hasText: "Amara Desk" }).first();
  await card.waitFor({ timeout: 15000 });
  await card.getByRole("button", { name: "Chat now" }).waitFor({ timeout: 15000 });
  await card.getByRole("button", { name: "Chat now" }).click();
  await cust.waitForURL("**/wait/**", { timeout: 15000 });
  await cust.getByText(/Billing starts only when they accept/i).waitFor({ timeout: 10000 });
  ok("wait page says billing starts after accept");

  await adv.getByRole("button", { name: "Accept" }).waitFor({ timeout: 15000 });
  await adv.getByRole("button", { name: "Accept" }).click();
  await adv.waitForURL("**/advisor/session/**", { timeout: 15000 });
  await cust.waitForURL("**/reading/**", { timeout: 15000 });
  await cust.waitForTimeout(2500);
  await shot(adv, "qa-billing-advisor-session");
  const aBody = await adv.locator("body").innerText();
  if (/c \/ min/i.test(aBody) && /you \d+c/i.test(aBody)) ok("advisor session shows rate and earnings");
  else fail("advisor session missing bill: " + aBody.slice(0, 400));

  await cust.getByPlaceholder("Ask what you need").fill("What is coming this week?");
  await cust.getByRole("button", { name: "Send" }).click();
  await adv.getByText("What is coming this week?").waitFor({ timeout: 8000 });
  await adv.getByPlaceholder("Reply to the client").fill("A quiet turn. Stay with it.");
  await adv.getByRole("button", { name: "Send" }).click();
  await cust.getByText("A quiet turn. Stay with it.").waitFor({ timeout: 8000 });
  ok("two-way chat during billed session");

  await adv.getByRole("button", { name: "End session" }).click();
  await adv.waitForURL("**/advisor", { timeout: 10000 });
  await cust.waitForTimeout(2500);
  const after = await cust.locator("body").innerText();
  if (/ended/i.test(after)) ok("customer session ended when advisor stopped billing");
  else fail("customer still live after advisor end: " + after.slice(0, 250));
} catch (e) {
  fail(e instanceof Error ? e.stack || e.message : String(e));
  await shot(cust, "qa-billing-cust-fail");
  await shot(adv, "qa-billing-adv-fail");
} finally {
  console.log("\n--- REPORT ---\n" + report.join("\n"));
  await browser.close();
  if (report.some((l) => l.startsWith("FAIL"))) process.exit(1);
}
