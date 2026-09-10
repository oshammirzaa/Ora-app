import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Live Client", email: `live-${stamp}@ora.test`, password: "testpass123" };
const LIVE_MS = 3 * 60 * 1000;

const report = [];
function ok(m) {
  report.push("OK  " + m);
  console.log("OK  " + m);
}
function fail(m) {
  report.push("FAIL " + m);
  console.log("FAIL " + m);
}

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

const pageErrors = [];
const dupKeys = [];
const undefLogs = [];
const getReadingHits = [];

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (err) => {
  const text = String(err.stack || err);
  if (/Hydration failed/i.test(text)) return;
  pageErrors.push(text);
  console.log("PAGEERROR", err.message);
  console.log(text.slice(0, 800));
});
page.on("console", (msg) => {
  const text = msg.text();
  if (msg.type() === "error" || /undefined/i.test(text) || /same key/i.test(text)) {
    if (/same key/i.test(text)) dupKeys.push(text);
    if (/undefined/i.test(text)) undefLogs.push(text);
    if (msg.type() === "error") console.log("CONSOLE", text.slice(0, 400));
  }
});
page.on("request", (req) => {
  const url = req.url();
  if (/getReading|_serverFn/i.test(url) && /getReading|Reading/i.test(url + (req.postData() || ""))) {
    getReadingHits.push(`${req.method()} ${url.slice(0, 180)}`);
  }
});

function screenBad(body) {
  return /something went wrong|cannot read propert|undefined is not/i.test(body);
}

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
  ok("signed up");

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByText("Choose an advisor").waitFor({ timeout: 20000 });
  await page.locator("header").getByRole("link", { name: "Sign in" }).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  await page.getByRole("button", { name: "Chat now" }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const posts = [];
  page.on("request", (req) => {
    if (req.method() === "POST") posts.push(req.url());
  });
  await page.getByRole("button", { name: "Chat now" }).first().click({ force: true });
  try {
    await page.waitForURL(/\/(reading|wait)\//, { timeout: 25000 });
  } catch {
    const toast = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
    throw new Error(
      "chat start failed url=" +
        page.url() +
        " posts=" +
        posts.join(",") +
        " toast=" +
        toast.join("|") +
        " body=" +
        (await page.locator("body").innerText()).slice(0, 300),
    );
  }
  ok("started chat " + page.url());

  const clock = () => page.locator(".text-5xl").first().innerText();
  const t0 = Date.now();
  let lastClock = await clock();
  ok("timer start " + lastClock);

  const prompts = [
    "What should I know about this week?",
    "Is this the right path for me?",
    "What am I not seeing?",
  ];
  for (const [i, text] of prompts.entries()) {
    const box = page.locator('input[placeholder="Ask what you need…"]');
    if (!(await box.count())) {
      const body = await page.locator("body").innerText();
      if (screenBad(body)) fail("error overlay before send: " + body.slice(0, 240));
      else fail("compose box missing at prompt " + (i + 1));
      break;
    }
    await box.fill(text);
    await page.getByRole("button", { name: "Send" }).click();
    try {
      await page.getByText(text).waitFor({ timeout: 20000 });
      const body = await page.locator("body").innerText();
      if (screenBad(body)) fail("error after send: " + body.slice(0, 300));
      else ok("client message visible: " + text.slice(0, 32));
    } catch {
      const body = await page.locator("body").innerText();
      if (screenBad(body)) fail("error after send: " + body.slice(0, 300));
      else fail("sent text not on screen: " + text);
    }
  }

  await page.screenshot({ path: "/workspace/screenshots/qa-chat-live-mid.png", fullPage: true });

  while (Date.now() - t0 < LIVE_MS) {
    await page.waitForTimeout(15000);
    const body = await page.locator("body").innerText();
    if (screenBad(body)) {
      fail("error overlay during live session: " + body.slice(0, 400));
      await page.screenshot({ path: "/workspace/screenshots/qa-chat-live-error.png", fullPage: true });
      break;
    }
    const nowClock = await clock().catch(() => "");
    if (nowClock && nowClock !== lastClock) {
      lastClock = nowClock;
    }
    const elapsed = Math.round((Date.now() - t0) / 1000);
    console.log(`alive ${elapsed}s clock=${nowClock} ended=${/session closed|this reading ended/i.test(body)} getReading=${getReadingHits.length}`);
  }

  const liveSecs = Math.round((Date.now() - t0) / 1000);
  if (liveSecs >= 175) ok(`stayed in session ${liveSecs}s`);
  else fail(`session check ended early at ${liveSecs}s`);

  const finalBody = await page.locator("body").innerText();
  await page.screenshot({ path: "/workspace/screenshots/qa-chat-live-end.png", fullPage: true });
  if (screenBad(finalBody)) fail("undefined/error on screen at end");
  else ok("no error overlay after 3 minutes");
  if (/0c charged|charged/.test(finalBody)) ok("wallet/session charge still shown");
  else fail("charge copy missing");
  if (/\d+:\d+/.test(finalBody)) ok("timer still rendered " + lastClock);
  else fail("timer missing");
  if (getReadingHits.length > 20) fail("getReading loop x" + getReadingHits.length);
  else ok("getReading calls " + getReadingHits.length);

  await page.locator("header a").first().click();
  await page.waitForURL("**/", { timeout: 8000 });
  ok("Home after live chat " + page.url());
  await page.getByRole("link", { name: "Wallet" }).click();
  await page.waitForURL("**/account", { timeout: 8000 });
  const walletBody = await page.locator("body").innerText();
  if (/Welcome minutes|Coins|Wallet/i.test(walletBody)) ok("Wallet opened after live chat");
  else fail("Wallet missing after live chat");

  if (pageErrors.length) fail("page errors:\n" + pageErrors.join("\n"));
  else ok("no page errors");
  if (dupKeys.length) fail("duplicate message keys x" + dupKeys.length);
  else ok("no duplicate message keys");
  const realUndef = undefLogs.filter((t) => /cannot read propert|undefined is not/i.test(t));
  if (realUndef.length) fail("undefined logs: " + realUndef.slice(0, 3).join(" | "));
  else ok("no undefined runtime logs");
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: "/workspace/screenshots/qa-chat-live-throw.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.some((l) => l.startsWith("FAIL"));
  console.log(failed ? "RESULT FAIL" : "RESULT PASS");
  await browser.close();
  if (failed) process.exit(1);
}
