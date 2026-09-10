import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Diag Client", email: `diag-${stamp}@ora.test`, password: "testpass123" };

const pageErrors = [];
const consoleErrors = [];
const failed = [];

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (err) => {
  pageErrors.push(String(err) + "\n" + (err.stack || ""));
  console.log("PAGEERROR", err.message, "\n", err.stack);
});
page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
    console.log("CONSOLE", msg.text());
  }
});
page.on("response", async (res) => {
  if (res.status() >= 400) {
    let body = "";
    try {
      body = (await res.text()).slice(0, 500);
    } catch {}
    failed.push(`${res.status()} ${res.request().method()} ${res.url()} ${body}`);
    console.log("HTTP", res.status(), res.request().method(), res.url(), body.slice(0, 200));
  }
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
  console.log("signed up");

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Chat now" }).first().waitFor({ timeout: 15000 });
  await page.locator("header").getByRole("link", { name: "Sign in" }).waitFor({ state: "detached", timeout: 15000 });
  await page.waitForTimeout(800);
  const amara = page.locator("li").filter({ hasText: "Amara Okonkwo" }).getByRole("button", { name: "Chat now" });
  if (await amara.count()) await amara.first().click({ force: true });
  else await page.getByRole("button", { name: "Chat now" }).first().click({ force: true });
  await page.waitForURL(/\/(reading|wait)\//, { timeout: 20000 });
  console.log("in chat", page.url());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/workspace/screenshots/qa-chat-error-1.png", fullPage: true });

  const body1 = await page.locator("body").innerText();
  console.log("body1", body1.slice(0, 400));
  if (/something went wrong|undefined/i.test(body1)) console.log("ERROR TEXT ON SCREEN after open");

  const box = page.locator('input[placeholder="Ask what you need…"]');
  if (await box.count()) {
    await box.fill("What should I know about this week?");
    await page.getByRole("button", { name: "Send" }).click();
    console.log("sent message");
    await page.waitForTimeout(4000);
  } else {
    console.log("no compose box", page.url());
  }

  await page.screenshot({ path: "/workspace/screenshots/qa-chat-error-2.png", fullPage: true });
  const body2 = await page.locator("body").innerText();
  console.log("body2", body2.slice(0, 600));
  if (/something went wrong|undefined/i.test(body2)) console.log("ERROR TEXT ON SCREEN after send");

  await page.waitForTimeout(8000);
  await page.screenshot({ path: "/workspace/screenshots/qa-chat-error-3.png", fullPage: true });
  const body3 = await page.locator("body").innerText();
  console.log("body3", body3.slice(0, 600));
} catch (e) {
  console.log("THROW", e instanceof Error ? e.stack : e);
  await page.screenshot({ path: "/workspace/screenshots/qa-chat-error-throw.png", fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify({ pageErrors, consoleErrors, failed }, null, 2));
  await browser.close();
}
