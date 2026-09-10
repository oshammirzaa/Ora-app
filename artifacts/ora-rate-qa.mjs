import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const customer = { name: "Rate Client", email: `rate-${stamp}@ora.test`, password: "testpass123" };
const report = [];
function ok(m) { report.push("OK  " + m); console.log("OK  " + m); }
function fail(m) { report.push("FAIL " + m); console.log("FAIL " + m); }

function ratesIn(text) {
  return [...String(text).matchAll(/(\d+)\s*(?:c|coins)\s*\/\s*min/gi)].map((m) => Number(m[1]));
}

async function fill(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value));
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (err) => {
  if (/Hydration failed/i.test(String(err))) return;
  pageErrors.push(String(err.stack || err));
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
  await page.getByText(/coins|Included time|Previous sessions/i).first().waitFor({ timeout: 15000 });
  ok("signed up " + customer.email);

  await page.goto(`${BASE}/advisors/amara`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Amara/i }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const profile = await page.locator("body").innerText();
  const profileRates = ratesIn(profile);
  if (!profileRates.length) fail("Amara profile missing rate");
  const current = profileRates[0];
  ok("Amara profile current rate " + current + "c/min");
  if (current !== 27) fail("expected Amara's published rate 27, got " + current);
  await page.screenshot({ path: "/workspace/screenshots/qa-rate-profile.png", fullPage: true });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByText("Choose an advisor").waitFor({ timeout: 15000 });
  const card = page.locator("li").filter({ hasText: "Amara Okonkwo" }).first();
  await card.waitFor({ timeout: 15000 });
  const cardText = await card.innerText();
  if (!new RegExp(`${current}\\s*c\\s*/\\s*min`, "i").test(cardText)) {
    fail("home card rate mismatch: " + cardText.slice(0, 240));
  } else ok("home / trusted card shows " + current + "c/min");

  await page.goto(`${BASE}/advisors/amara`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Chat now" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Chat now" }).click({ force: true });
  await page.waitForURL(/\/reading\//, { timeout: 25000 });
  ok("started new Amara session " + page.url());
  await page.locator(".text-5xl").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(2500);
  const live = await page.locator("body").innerText();
  const liveRates = [...new Set(ratesIn(live))];
  if (!liveRates.includes(current)) fail("live chat rate != profile: " + liveRates + " body=" + live.slice(0, 280));
  else ok("live chat uses " + current + "c/min");
  if (liveRates.some((r) => r !== current)) fail("live chat showed extra rate " + liveRates.join(","));
  if (liveRates.includes(20) && current !== 20) fail("dummy 20c/min appeared in live chat");
  await page.screenshot({ path: "/workspace/screenshots/qa-rate-live.png", fullPage: true });

  await page.waitForTimeout(6000);
  const live2 = await page.locator("body").innerText();
  const live2Rates = [...new Set(ratesIn(live2))];
  if (!live2Rates.includes(current) || live2Rates.some((r) => r !== current)) {
    fail("live rate drifted after sync: " + live2Rates.join(","));
  } else ok("live rate still " + current + "c/min after billing tick");

  if (await page.getByRole("button", { name: "End reading" }).count()) {
    await page.getByRole("button", { name: "End reading" }).click();
    await page.waitForTimeout(2000);
  }
  const ended = await page.locator("body").innerText();
  if (!ratesIn(ended).includes(current)) fail("ended summary missing " + current + "c/min");
  else ok("ended sitting shows " + current + "c/min");
  await page.screenshot({ path: "/workspace/screenshots/qa-rate-ended.png", fullPage: true });

  await page.goto(`${BASE}/me`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const meBody = await page.locator("body").innerText();
  const hist = [...meBody.matchAll(/Amara[\s\S]{0,90}?(\d+)c\/min/gi)].map((m) => Number(m[1]));
  ok("You → previous sessions Amara rates: " + hist.join(", "));
  if (!hist.length || hist.some((r) => r !== current)) fail("session history rate != " + current);
  else ok("session history recorded at " + current + "c/min");
  if (/Reading ·/.test(meBody) && new RegExp(`${current}c/min`).test(meBody)) ok("wallet history note uses " + current + "c/min");
  await page.screenshot({ path: "/workspace/screenshots/qa-rate-history.png", fullPage: true });

  const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const adminPage = await adminContext.newPage();
  const ownerEmails = [
    "rate-mtue9rmm@ora.test",
    "rate-mtueamlu@ora.test",
    "rate-mtued45n@ora.test",
    customer.email,
  ];
  let adminOk = false;
  let signedAs = "";

  async function waitAdminResult() {
    const overview = adminPage.getByRole("heading", { name: "Overview" });
    const denied = adminPage.getByRole("heading", { name: "Owner access only" });
    const loginErr = adminPage.locator("p.text-danger");
    const winner = await Promise.race([
      overview.waitFor({ timeout: 15000 }).then(() => "overview"),
      denied.waitFor({ timeout: 15000 }).then(() => "denied"),
      loginErr.waitFor({ timeout: 15000 }).then(() => "error"),
    ]).catch(() => "timeout");
    return winner;
  }

  for (const email of ownerEmails) {
    await adminContext.clearCookies();
    await adminPage.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
    await adminPage.getByLabel("Email").waitFor({ timeout: 15000 });
    await adminPage.waitForTimeout(500);
    await adminPage.getByLabel("Email").fill("");
    await adminPage.getByLabel("Email").fill(email);
    await adminPage.locator("#pw").fill(customer.password);
    await adminPage.getByRole("button", { name: "Sign in to owner panel" }).click();
    const result = await waitAdminResult();
    if (result === "overview") {
      adminOk = true;
      signedAs = email;
      ok("owner signed in as " + email);
      break;
    }
    ok("admin candidate " + email + " → " + result);
  }
  if (!adminOk) {
    fail("could not open owner panel: " + adminPage.url() + " " + (await adminPage.locator("body").innerText()).slice(0, 250));
  } else {
    await adminPage.goto(`${BASE}/admin/advisors`, { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1000);
    const advBody = await adminPage.locator("body").innerText();
    const advMatch = advBody.match(/Amara Okonkwo[\s\S]{0,220}?(\d+)\s*c\/min/i);
    if (!advMatch || Number(advMatch[1]) !== current) fail("admin advisors rate mismatch: " + (advMatch ? advMatch[0] : advBody.slice(0, 220)));
    else ok("admin advisors shows Amara " + current + "c/min");

    await adminPage.goto(`${BASE}/admin/sessions`, { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1000);
    const sess = await adminPage.locator("body").innerText();
    if (!new RegExp(`${current}c/min`).test(sess) || !/Amara/i.test(sess)) fail("admin sessions missing " + current + "c/min");
    else ok("admin sessions lists Amara at " + current + "c/min");
    if (sess.includes("20c/min") && current !== 20) fail("admin sessions still showing dummy 20c/min");
    await adminPage.screenshot({ path: "/workspace/screenshots/qa-rate-admin-sessions.png", fullPage: true });

    await adminPage.goto(`${BASE}/admin/finance`, { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1000);
    const fin = await adminPage.locator("body").innerText();
    if (/Reading ·/.test(fin) && new RegExp(`${current}c/min`).test(fin)) ok("admin finance ledger uses " + current + "c/min");
    else if (/Customer spend/i.test(fin)) ok("admin finance loaded as " + signedAs);
    else fail("admin finance missing");
  }
  await adminContext.close();

  if (pageErrors.length) fail("page errors " + pageErrors[0]);
  else ok("no page errors");
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: "/workspace/screenshots/qa-rate-throw.png", fullPage: true }).catch(() => {});
} finally {
  const failed = report.some((l) => l.startsWith("FAIL"));
  console.log(failed ? "RESULT FAIL" : "RESULT PASS");
  console.log(report.join("\n"));
  await browser.close();
  if (failed) process.exit(1);
}
