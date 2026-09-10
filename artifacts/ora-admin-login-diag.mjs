import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const email = process.argv[2] || "rate-mtue9rmm@ora.test";
const password = "testpass123";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  await page.getByLabel("Email").fill(email);
  await page.locator("#pw").fill(password);
  await page.getByRole("button", { name: "Sign in to owner panel" }).click();
  const reached = await page
    .getByRole("heading", { name: "Overview" })
    .waitFor({ timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  console.log("reached overview heading", reached);
  console.log("url", page.url());
  console.log("headings", await page.getByRole("heading").allTextContents());
  console.log("---BODY---");
  console.log(await page.locator("body").innerText());
  await page.screenshot({ path: "/workspace/screenshots/qa-rate-admin-diag.png", fullPage: true });
} finally {
  await browser.close();
}
