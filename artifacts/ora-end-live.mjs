import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").waitFor();
await page.waitForTimeout(800);
await page.getByLabel("Email").fill("paidchat-mtukf4f4@ora.test");
await page.locator("#pw").fill("testpass123");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
await page.goto(`${BASE}/reading/read_mtukgoj9l4dcf`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const end = page.getByRole("button", { name: "End reading" });
if (await end.count()) {
  await end.click();
  await page.waitForTimeout(2000);
  console.log("ended", await page.locator("body").innerText().then((t) => t.slice(0, 300)));
} else {
  console.log("no end button", page.url(), (await page.locator("body").innerText()).slice(0, 300));
}
await browser.close();
