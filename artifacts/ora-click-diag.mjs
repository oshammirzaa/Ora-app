import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Click Diag", email: `cd-${stamp}@ora.test`, password: "testpass123" };

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const reqs = [];
page.on("request", (req) => reqs.push(req.method() + " " + req.url()));
page.on("pageerror", (err) => console.log("PAGEERROR", err.message));

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
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByText("Choose an advisor").waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Chat now" }).first().waitFor();
  await page.waitForTimeout(1500);
  reqs.length = 0;
  const info = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Chat now");
    return btns.slice(0, 3).map((b) => ({
      disabled: b.disabled,
      type: b.type,
      cls: b.className.slice(0, 80),
    }));
  });
  console.log("buttons", JSON.stringify(info));
  await page.getByRole("button", { name: "Chat now" }).first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(4000);
  console.log("url", page.url());
  console.log("reqs", reqs.filter((u) => /serverFn|requestChat|reading|api/.test(u)).join("\n"));
  console.log("all post", reqs.filter((u) => u.startsWith("POST")).join("\n"));
} catch (e) {
  console.log("THROW", e instanceof Error ? e.message : e);
  console.log("url", page.url());
} finally {
  await browser.close();
}
