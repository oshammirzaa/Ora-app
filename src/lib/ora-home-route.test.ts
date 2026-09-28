import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  accountHomePath,
  customerHomeGuardDecision,
  isAdvisorAccountRole,
  loginHrefForRole,
  resolveOraMarkTarget,
} from "./ora-home-route.ts";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("website advisor home routing", () => {
  it("sends website advisors to the advisor dashboard and leaves everyone else on customer home", () => {
    assert.equal(isAdvisorAccountRole("advisor"), true);
    assert.equal(isAdvisorAccountRole(" Advisor "), true);
    assert.equal(isAdvisorAccountRole("customer"), false);
    assert.equal(isAdvisorAccountRole("client"), false);
    assert.equal(isAdvisorAccountRole("admin"), false);

    assert.equal(accountHomePath({ role: "advisor", hostname: "orapsychic.com" }), "/advisor");
    assert.equal(accountHomePath({ role: "advisor", hostname: "www.orapsychic.com" }), "/advisor");
    assert.equal(accountHomePath({ role: "advisor", marketingHost: true }), "/advisor");
    assert.equal(accountHomePath({ role: "customer", hostname: "orapsychic.com" }), "/home");
    assert.equal(accountHomePath({ role: "client", hostname: "www.orapsychic.com" }), "/home");
    assert.equal(accountHomePath({ role: "", hostname: "orapsychic.com" }), "/home");

    assert.equal(accountHomePath({ role: "advisor", hostname: "orapsychic.xyz" }), "/home");
    assert.equal(accountHomePath({ role: "advisor", hostname: "www.orapsychic.xyz" }), "/home");
    assert.equal(accountHomePath({ role: "advisor", marketingHost: false }), "/home");
    assert.equal(accountHomePath({ role: "customer", hostname: "orapsychic.xyz" }), "/home");
  });

  it("rewrites only a customer-home login target and never leaves the current site", () => {
    assert.equal(loginHrefForRole("/home", { role: "advisor", hostname: "orapsychic.com" }), "/advisor");
    assert.equal(loginHrefForRole("/home", { role: "client", hostname: "orapsychic.com" }), "/home");
    assert.equal(loginHrefForRole("/home", { role: "advisor", hostname: "orapsychic.xyz" }), "/home");
    assert.equal(loginHrefForRole("/advisor", { role: "advisor", hostname: "orapsychic.com" }), "/advisor");
    assert.equal(loginHrefForRole("/admin", { role: "admin", hostname: "orapsychic.com" }), "/admin");
    assert.equal(loginHrefForRole("/advisor/applied", { role: "advisor", hostname: "orapsychic.com" }), "/advisor/applied");
    assert.equal(loginHrefForRole("/home", { role: "advisor", hostname: "orapsychic.com" }).startsWith("http"), false);
  });

  it("points the Ora logo at the advisor dashboard for website advisors only", () => {
    assert.equal(resolveOraMarkTarget("/home", { role: "advisor", marketingHost: true }), "/advisor");
    assert.equal(resolveOraMarkTarget("/", { role: "advisor", marketingHost: true }), "/advisor");
    assert.equal(resolveOraMarkTarget("/advisor", { role: "advisor", marketingHost: true }), "/advisor");
    assert.equal(resolveOraMarkTarget("/home", { role: "client", marketingHost: true }), "/home");
    assert.equal(resolveOraMarkTarget("/", { role: "client", marketingHost: true }), "/");
    assert.equal(resolveOraMarkTarget("/", { role: "", marketingHost: true }), "/");
    assert.equal(resolveOraMarkTarget("/home", { role: "advisor", marketingHost: false }), "/home");
    assert.equal(resolveOraMarkTarget("/", { role: "advisor", marketingHost: false }), "/");
  });

  it("guards customer /home on the website and not on the app", () => {
    assert.deepEqual(customerHomeGuardDecision({ marketingHost: true, role: "advisor" }), {
      action: "redirect",
      to: "/advisor",
    });
    assert.deepEqual(customerHomeGuardDecision({ marketingHost: true, role: "client" }), { action: "allow" });
    assert.deepEqual(customerHomeGuardDecision({ marketingHost: true, role: "customer" }), { action: "allow" });
    assert.deepEqual(customerHomeGuardDecision({ marketingHost: false, role: "advisor" }), { action: "allow" });
    assert.deepEqual(customerHomeGuardDecision({ marketingHost: true, role: "" }), { action: "allow" });
  });

  it("wires the logo, Home controls, login, and /home guard without sending the website to the app host", () => {
    const home = source("../routes/home.tsx");
    const brand = source("../components/ora-brand.tsx");
    const shell = source("../components/app-shell.tsx");
    const desk = source("../components/advisor-shell.tsx");
    const login = source("../routes/login.tsx");
    const advisorLogin = source("../routes/advisor/login.tsx");
    assert.match(home, /customerHomeGuardDecision/);
    assert.match(home, /redirect\(\{ to: "\/advisor", replace: true \}\)/);
    assert.match(home, /CustomerHomeBody/);
    assert.match(brand, /useOraMarkTarget/);
    assert.match(shell, /useAccountHomeLink/);
    assert.match(desk, /website \? "\/advisor" : "\/home"/);
    assert.match(login, /loginHrefForRole/);
    assert.match(advisorLogin, /loginHrefForRole/);
    for (const file of [home, brand, shell, desk, login, advisorLogin]) {
      assert.equal(file.includes("orapsychic.xyz"), false);
    }
  });
});
