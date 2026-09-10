import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Diag Client", email: `diag-${stamp}@ora.test`, password: "testpass123" };

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("console", (msg) => console.log("CONSOLE", msg.type(), msg.text()));
page.on("pageerror", (e) => console.log("PAGEERROR", String(e)));
page.on("response", (res) => {
  const u = res.url();
  if (u.includes("_server") || u.includes("ora") || res.request().method() === "POST") {
    console.log("RESP", res.status(), res.request().method(), u.slice(0, 180));
  }
});

await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.getByLabel("Full name").waitFor();
await page.waitForTimeout(800);
await fill(page, "Full name", customer.name);
await fill(page, "Email", customer.email);
await fill(page, "Password", customer.password);
await fill(page, "Confirm password", customer.password);
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL("**/me", { timeout: 20000 });
console.log("signed up", page.url());

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.locator("header").getByRole("link", { name: "Sign in" }).waitFor({ state: "detached", timeout: 15000 });
const buttons = await page.getByRole("button", { name: "Chat now" }).count();
console.log("chat buttons", buttons);
const t0 = Date.now();
const click = page.getByRole("button", { name: "Chat now" }).first().click();
const waited = page.waitForURL(/\/(reading|wait)\//, { timeout: 12000 }).then(() => "url").catch((e) => "timeout:" + e.message);
const toast = page.locator("[data-sonner-toast]").first().waitFor({ timeout: 12000 }).then(() => "toast").catch(() => "no-toast");
await click;
const which = await Promise.race([waited, toast]);
console.log("after click", Date.now() - t0, "ms", which, "url=", page.url());
console.log("toast", await page.locator("body").innerText().then((t) => t.slice(0, 400)));
await page.screenshot({ path: "/workspace/screenshots/qa-chat-diag.png", fullPage: true });
await browser.close();
