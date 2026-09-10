import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Diag Two", email: `d2-${stamp}@ora.test`, password: "testpass123" };

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (err) => console.log("PAGEERROR", err.message, err.stack));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text().slice(0, 400));
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
  console.log("after signup", page.url());
  console.log("me body", (await page.locator("body").innerText()).slice(0, 300));
  await page.screenshot({ path: "/workspace/screenshots/qa-home-diag-me.png" });

  const res = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("home status", res?.status(), page.url());
  await page.waitForTimeout(3000);
  console.log("home body", (await page.locator("body").innerText()).slice(0, 800));
  await page.screenshot({ path: "/workspace/screenshots/qa-home-diag.png", fullPage: true });
} catch (e) {
  console.log("THROW", e instanceof Error ? e.stack : e);
  console.log("url", page.url());
  console.log("body", (await page.locator("body").innerText().catch(() => "")).slice(0, 800));
  await page.screenshot({ path: "/workspace/screenshots/qa-home-diag-throw.png" }).catch(() => {});
} finally {
  await browser.close();
}
