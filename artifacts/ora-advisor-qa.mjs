import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const stamp = Date.now().toString(36);
const customer = {
  name: "Client Quinn",
  email: `client.${stamp}@ora.test`,
  password: "testpass123",
};
const advisor = {
  legal: "Amara Desk",
  name: "Amara Desk",
  email: `advisor.${stamp}@ora.test`,
  password: "testpass123",
};

function shot(page, name) {
  return page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function fill(page, label, value) {
  const loc = page.getByLabel(label, { exact: true });
  if ((await loc.count()) === 0) {
    throw new Error(`missing label ${label} on ${page.url()}`);
  }
  await loc.first().fill(String(value));
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const advCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const cust = await custCtx.newPage();
const adv = await advCtx.newPage();
cust.on("console", (m) => {
  if (m.type() === "error") console.log("CUST console", m.text());
});
cust.on("pageerror", (e) => console.log("CUST pageerror", e.message));
adv.on("console", (m) => {
  if (m.type() === "error") console.log("ADV console", m.text());
});
adv.on("pageerror", (e) => console.log("ADV pageerror", e.message));

const report = [];
function ok(msg) {
  report.push("OK  " + msg);
  console.log("OK  " + msg);
}
function fail(msg) {
  report.push("FAIL " + msg);
  console.log("FAIL " + msg);
}

try {
  await cust.goto(BASE, { waitUntil: "domcontentloaded" });
  const live = await cust.getByText("Live", { exact: true }).count();
  const chat = await cust.getByRole("button", { name: "Chat now" }).count();
  await shot(cust, "qa-home");
  if (live >= 8 && chat >= 8) ok(`homepage Live=${live} Chat now=${chat}`);
  else fail(`homepage Live=${live} Chat now=${chat}`);

  await cust.getByRole("link", { name: "Work", exact: true }).click();
  await cust.waitForURL(/advisor/);
  await shot(cust, "qa-advisor-login");
  if (cust.url().includes("/advisor")) ok("Work tab opens advisor desk/login " + cust.url());
  else fail("Work tab did not open advisor: " + cust.url());

  await cust.goto(`${BASE}/signup`, { waitUntil: "load" });
  await cust.getByLabel("Full name").waitFor();
  await cust.waitForTimeout(400);
  await fill(cust, "Full name", customer.name);
  await fill(cust, "Email", customer.email);
  await fill(cust, "Password", customer.password);
  await fill(cust, "Confirm password", customer.password);
  await cust.getByRole("checkbox").check();
  const nameVal = await cust.getByLabel("Full name").inputValue();
  const emailVal = await cust.getByLabel("Email").inputValue();
  if (nameVal !== customer.name || emailVal !== customer.email) {
    throw new Error(`signup fields reset name=${nameVal} email=${emailVal}`);
  }
  await shot(cust, "qa-customer-signup");
  await cust.getByRole("button", { name: "Create account" }).click();
  try {
    await cust.waitForURL("**/me", { timeout: 20000 });
  } catch (e) {
    await shot(cust, "qa-customer-signup-fail");
    throw new Error("customer signup failed: " + (await cust.locator("body").innerText()).slice(0, 600));
  }
  await cust.waitForTimeout(800);
  await shot(cust, "qa-customer-me");
  ok("customer signed up " + cust.url());

  await adv.goto(`${BASE}/advisor/signup`, { waitUntil: "load" });
  await adv.getByLabel("Full name").waitFor();
  await adv.waitForTimeout(1200);
  await adv.locator("#legal").fill(advisor.legal);
  await adv.locator("#disp").fill(advisor.name);
  await adv.locator("#email").fill(advisor.email);
  await adv.locator("#pw").fill(advisor.password);
  await adv.locator("#pw2").fill(advisor.password);
  await adv.locator("#bio").fill("I read love and timing with a quiet room and a sharp eye for patterns.");
  await adv.locator("#ex").fill("10 years of private sittings.");
  await adv.locator("#sp").fill("Love, Tarot");
  await adv.locator("#yr").fill("10");
  await adv.locator("#rate").fill("20");
  await adv.locator("#lang").fill("English");
  const filledName = await adv.locator("#legal").inputValue();
  if (filledName !== advisor.legal) throw new Error("advisor fields reset after fill: " + filledName);
  await adv.locator("#photo").setInputFiles("/workspace/public/images/amara.jpg");
  await adv.waitForTimeout(1500);
  const preview = await adv.locator("form img").count();
  if (!preview) {
    await shot(adv, "qa-photo-fail");
    throw new Error("photo preview missing, name still " + (await adv.locator("#legal").inputValue()));
  }
  await adv.getByRole("checkbox").check();
  await shot(adv, "qa-advisor-signup");
  await adv.getByRole("button", { name: "Submit application" }).click();
  try {
    await adv.getByText("pending verification").waitFor({ timeout: 25000 });
  } catch (e) {
    throw new Error("advisor submit failed: " + (await adv.locator("body").innerText()).slice(0, 500));
  }
  await shot(adv, "qa-advisor-pending");
  ok("advisor application pending on desk");

  await cust.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await cust.getByRole("heading", { name: "Owner panel" }).waitFor({ timeout: 15000 });
  await cust.waitForTimeout(1200);
  await shot(cust, "qa-admin");
  const approve = cust.getByRole("button", { name: "Approve" }).first();
  try {
    await approve.waitFor({ timeout: 10000 });
  } catch {
    throw new Error("no Approve: " + (await cust.locator("body").innerText()).slice(0, 700));
  }
  if (await approve.count()) {
    await approve.click();
    await cust.waitForTimeout(1500);
    ok("admin approved advisor");
  } else {
    fail("no Approve button on admin. body=" + (await cust.locator("body").innerText()).slice(0, 400));
  }

  await adv.goto(`${BASE}/advisor`, { waitUntil: "domcontentloaded" });
  await adv.waitForTimeout(1500);
  const onlineBtn = adv.getByRole("button", { name: "Offline" });
  if (await onlineBtn.count()) {
    await onlineBtn.click();
    await adv.waitForTimeout(1000);
    const on = await adv.getByRole("button", { name: "Online" }).count();
    if (on) ok("advisor toggled Online");
    else fail("online toggle did not stick");
  } else {
    fail("no Offline toggle after approval: " + (await adv.locator("body").innerText()).slice(0, 400));
  }
  await shot(adv, "qa-advisor-online");

  await cust.goto(BASE, { waitUntil: "domcontentloaded" });
  await cust.waitForTimeout(2000);
  await shot(cust, "qa-home-after-online");
  const amara = cust.getByText("Amara Desk").first();
  if (await amara.count()) ok("approved advisor visible on homepage");
  else fail("Amara Desk not on homepage");

  const card = cust.locator("li", { hasText: "Amara Desk" }).first();
  const chatBtn = card.getByRole("button", { name: "Chat now" });
  if (await chatBtn.count()) {
    await chatBtn.click();
  } else {
    await cust.getByRole("link", { name: /Amara Desk/ }).first().click();
    await cust.waitForTimeout(800);
    await cust.getByRole("button", { name: "Chat now" }).click();
  }
  await cust.waitForTimeout(2000);
  await shot(cust, "qa-wait");
  if (cust.url().includes("/wait/")) ok("customer waiting for accept " + cust.url());
  else fail("expected wait page, got " + cust.url() + " " + (await cust.locator("body").innerText()).slice(0, 200));

  await adv.goto(`${BASE}/advisor`, { waitUntil: "domcontentloaded" });
  await adv.waitForTimeout(3500);
  await shot(adv, "qa-incoming");
  const accept = adv.getByRole("button", { name: "Accept" }).first();
  if (await accept.count()) {
    await accept.click();
    await adv.waitForURL(/session/, { timeout: 15000 });
    ok("advisor accepted, session " + adv.url());
  } else {
    fail("no Accept on desk: " + (await adv.locator("body").innerText()).slice(0, 400));
  }
  await shot(adv, "qa-advisor-session");

  await cust.waitForURL(/reading/, { timeout: 15000 });
  ok("customer entered reading " + cust.url());
  await cust.getByPlaceholder("Ask what you need").fill("What is coming this month?");
  await cust.getByRole("button", { name: "Send" }).click();
  await cust.waitForTimeout(1500);
  await shot(cust, "qa-customer-chat");

  await adv.waitForTimeout(2500);
  const asked = await adv.getByText("What is coming this month?").count();
  if (asked) ok("advisor sees customer message");
  else fail("advisor missing customer message");
  await adv.getByPlaceholder("Reply to the client").fill("A door opens if you stop waiting for permission.");
  await adv.getByRole("button", { name: "Send" }).click();
  await adv.waitForTimeout(1000);
  await shot(adv, "qa-advisor-reply");

  await cust.waitForTimeout(3000);
  const reply = await cust.getByText(/door opens/i).count();
  if (reply) ok("customer sees advisor reply");
  else fail("customer missing advisor reply");
  await shot(cust, "qa-two-sided");
} catch (e) {
  fail(String(e && e.stack ? e.stack : e));
  try {
    await shot(cust, "qa-cust-error");
    await shot(adv, "qa-adv-error");
  } catch {}
}

console.log("\n--- REPORT ---\n" + report.join("\n"));
await browser.close();
const failed = report.some((l) => l.startsWith("FAIL"));
process.exit(failed ? 1 : 0);
