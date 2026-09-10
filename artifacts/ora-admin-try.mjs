import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext();
const page = await ctx.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").waitFor();
await page.waitForTimeout(800);
await page.getByLabel("Email").fill("funds-mtufmcgh@ora.test");
await page.locator("#pw").fill("testpass123");
await page.getByRole("button", { name: "Sign in to owner panel" }).click();
const state = await Promise.race([
  page.getByRole("heading", { name: "Overview" }).waitFor({ timeout: 15000 }).then(() => "ok"),
  page.getByText("Owner access only").waitFor({ timeout: 15000 }).then(() => "deny"),
  page.locator("form p.text-danger").waitFor({ timeout: 15000 }).then(() => "bad"),
]).catch(() => "timeout");
console.log(state, page.url());
console.log((await page.locator("body").innerText()).slice(0, 200).replace(/\n+/g, " | "));
await browser.close();
