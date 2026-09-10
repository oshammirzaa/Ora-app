import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("console", (m) => console.log("console", m.type(), m.text()));
page.on("pageerror", (e) => console.log("pageerror", e.message));

async function tryLogin(path, submit, email) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  console.log("url", page.url());
  await page.waitForTimeout(1200);
  const body = (await page.locator("body").innerText()).slice(0, 400);
  console.log("body", body.replace(/\n/g, " | "));
  const emailLoc = page.getByLabel("Email");
  console.log("email count", await emailLoc.count());
  if (await emailLoc.count()) {
    await emailLoc.fill(email);
    await page.locator("#pw").fill("testpass123");
    await page.getByRole("button", { name: submit }).click();
    await page.waitForTimeout(4000);
    console.log("after", page.url());
    console.log("after body", (await page.locator("body").innerText()).slice(0, 500).replace(/\n/g, " | "));
  }
  await page.screenshot({ path: `/workspace/screenshots/qa-payout-diag-${path.replace(/\W+/g, "_")}.png`, fullPage: true });
}

await tryLogin("/admin/login", "Sign in to owner panel", "paidchat-mtukf4f4@ora.test");
await tryLogin("/login", "Sign in", "paidchat-mtukf4f4@ora.test");
await tryLogin("/advisor/login", "Sign in to desk", "paidchat-mtukf4f4@ora.test");
await browser.close();
