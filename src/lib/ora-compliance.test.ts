import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminGate } from "./ora-admin-auth.ts";
import {
  CONTACT_WARNING,
  MEDICAL_WARNING,
  OFF_PLATFORM_ATTEMPT_WARNING,
  SEXUAL_ADVISOR_WARNING,
  SEXUAL_CUSTOMER_NOTICE,
  UNDER18_WARNING,
  accountIsUnder18,
  applyAiClassification,
  canReadAiReports,
  classifyCompliance,
  matchesAiReportFilters,
  shouldBlockCompliance,
} from "./ora-compliance.ts";

const NOW = new Date("2026-09-25T12:00:00Z");

describe("compliance contact details", () => {
  it("blocks a customer phone number and flags it for review", () => {
    const hit = classifyCompliance({ body: "my number is 555 010 0199", sender: "customer" });
    assert.equal(hit?.category, "personal_info");
    assert.equal(hit?.risk, "medium");
    assert.equal(hit?.block, true);
    assert.equal(shouldBlockCompliance(hit), true);
    assert.equal(hit?.warning, CONTACT_WARNING);
    assert.equal(hit?.stopReading, false);
  });

  it("treats an advisor phone number as a higher-priority incident", () => {
    const hit = classifyCompliance({ body: "my cell is 555 010 0199", sender: "advisor" });
    assert.equal(hit?.category, "personal_info");
    assert.equal(hit?.risk, "high");
    assert.equal(shouldBlockCompliance(hit), true);
  });

  it("blocks spaced and word-form phone numbers", () => {
    const spaced = classifyCompliance({ body: "text me at 5 5 5 0 1 0 0 1 9 9", sender: "customer" });
    const words = classifyCompliance({
      body: "my number is five five five zero one zero zero one nine nine",
      sender: "advisor",
    });
    assert.equal(spaced?.category, "personal_info");
    assert.equal(shouldBlockCompliance(spaced), true);
    assert.equal(words?.risk, "high");
    assert.equal(shouldBlockCompliance(words), true);
  });

  it("blocks an email exchange including obfuscated addresses", () => {
    const plain = classifyCompliance({ body: "email me at reader@example.com", sender: "customer" });
    const hidden = classifyCompliance({ body: "sara at example dot com", sender: "advisor" });
    assert.equal(plain?.category, "personal_info");
    assert.equal(shouldBlockCompliance(plain), true);
    assert.equal(hidden?.category, "personal_info");
    assert.equal(hidden?.risk, "high");
  });

  it("blocks a social handle exchange and an off-platform contact request", () => {
    const handle = classifyCompliance({ body: "find me on instagram @luna.reads", sender: "customer" });
    const ask = classifyCompliance({ body: "message me on WhatsApp", sender: "advisor" });
    assert.equal(handle?.category, "off_platform");
    assert.equal(shouldBlockCompliance(handle), true);
    assert.equal(ask?.category, "off_platform");
    assert.equal(ask?.risk, "high");
    assert.equal(ask?.warning, CONTACT_WARNING);
  });

  it("reports a customer asking for Facebook or another off-platform contact", () => {
    for (const body of [
      "Can I have your Facebook?",
      "What is your Facebook?",
      "Give me your Facebook details",
      "Can I contact you on Facebook?",
      "What's your Instagram?",
      "Can I have your number?",
      "Can we talk on WhatsApp?",
    ]) {
      const hit = classifyCompliance({ body, sender: "customer" });
      assert.ok(hit, body);
      assert.ok(hit?.category === "off_platform" || hit?.category === "personal_info", body);
      assert.equal(hit?.block, true, body);
      assert.equal(shouldBlockCompliance(hit), true, body);
    }
    const outsideOra = classifyCompliance({ body: "Can we talk outside Ora?", sender: "customer" });
    assert.equal(outsideOra?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(shouldBlockCompliance(outsideOra), true);
    assert.equal(classifyCompliance({ body: "Can I have your number?", sender: "customer" })?.category, "personal_info");
    assert.equal(classifyCompliance({ body: "Can I have your Facebook?", sender: "customer" })?.category, "off_platform");
  });

  it("reports an advisor giving Facebook or social contact without a URL", () => {
    for (const body of [
      "My Facebook is John Smith",
      "Find me on Facebook as John Smith",
      "Message me on Facebook",
      "My Instagram is @example",
      "WhatsApp me on 5550100199",
      "My number is 555 010 0199",
      "Email me at reader@example.com",
    ]) {
      const hit = classifyCompliance({ body, sender: "advisor" });
      assert.ok(hit, body);
      assert.equal(hit?.risk, "high", body);
      assert.equal(shouldBlockCompliance(hit), true, body);
    }
    assert.equal(classifyCompliance({ body: "My Facebook is John Smith", sender: "advisor" })?.category, "off_platform");
    assert.equal(classifyCompliance({ body: "Find me on Instagram @testuser", sender: "advisor" })?.category, "off_platform");
  });

  it("blocks external payment requests and does not auto-suspend", () => {
    const hit = classifyCompliance({ body: "pay me on venmo instead", sender: "advisor" });
    assert.equal(hit?.category, "external_payment");
    assert.equal(hit?.risk, "high");
    assert.equal(shouldBlockCompliance(hit), true);
    assert.equal("suspend" in (hit || {}), false);
  });

  it("detects social contact requests and sharing without requiring a URL", () => {
    const customer = [
      "Can I have your Facebook?",
      "What is your Facebook?",
      "What's your Insta?",
      "Give me your Snapchat",
      "Can I add you on Facebook?",
      "Can we talk on Messenger?",
      "What's your TikTok?",
      "Can we talk on TikTok?",
      "What's your Snapchat?",
      "Can I have your face book?",
      "What's your fb?",
    ];
    for (const body of customer) {
      const hit = classifyCompliance({ body, sender: "customer" });
      assert.equal(hit?.category, "off_platform", body);
      assert.equal(hit?.block, true, body);
      assert.equal(shouldBlockCompliance(hit), true, body);
    }
    const advisor = [
      "Find me on Facebook as John Smith",
      "My Instagram is @example",
      "My Instagram is @testuser",
      "Add me on Snapchat",
      "Message me on Telegram",
      "Let's talk on WhatsApp",
      "Search my name on Facebook",
      "Find me on Facebook as Test Advisor",
    ];
    for (const body of advisor) {
      const hit = classifyCompliance({ body, sender: "advisor" });
      assert.equal(hit?.category, "off_platform", body);
      assert.equal(hit?.risk, "high", body);
      assert.equal(shouldBlockCompliance(hit), true, body);
    }
  });
});

describe("compliance context and false positives", () => {
  it("flags advisor private disclosures but not ordinary supportive lines", () => {
    const disclosed = classifyCompliance({ body: "my real name is Alex, let's meet privately", sender: "advisor" });
    assert.equal(disclosed?.category, "advisor_disclosure");
    assert.equal(disclosed?.risk, "high");
    assert.equal(shouldBlockCompliance(disclosed), true);
    assert.equal(
      classifyCompliance({
        body: "I understand. I am here to help. I have seen similar situations in readings.",
        sender: "advisor",
      }),
      null,
    );
  });

  it("does not flag normal relationship language", () => {
    for (const body of [
      "We haven't been intimate recently.",
      "There is still a physical attraction.",
      "I feel a romantic connection.",
      "Can you read our sexual compatibility?",
    ]) {
      assert.equal(classifyCompliance({ body, sender: "advisor" }), null, body);
      assert.equal(classifyCompliance({ body, sender: "customer" }), null, body);
    }
  });

  it("blocks advisor explicit content and only warns when a customer starts it", () => {
    const advisor = classifyCompliance({ body: "send nudes and let's have sex", sender: "advisor" });
    const customer = classifyCompliance({ body: "I'm horny, want erotic chat", sender: "customer" });
    assert.equal(advisor?.category, "sexual");
    assert.equal(advisor?.risk, "high");
    assert.equal(advisor?.warning, SEXUAL_ADVISOR_WARNING);
    assert.equal(shouldBlockCompliance(advisor), true);
    assert.equal(customer?.category, "sexual");
    assert.equal(customer?.block, false);
    assert.equal(shouldBlockCompliance(customer), false);
    assert.equal(customer?.advisorWarning, SEXUAL_CUSTOMER_NOTICE);
  });

  it("blocks advisor medical advice and allows a safe referral", () => {
    const unsafe = classifyCompliance({
      body: "You have diabetes. Stop your medication.",
      sender: "advisor",
    });
    assert.equal(unsafe?.category, "medical");
    assert.equal(unsafe?.risk, "high");
    assert.equal(unsafe?.warning, MEDICAL_WARNING);
    assert.equal(shouldBlockCompliance(unsafe), true);
    assert.equal(
      classifyCompliance({
        body: "Please speak with a qualified medical professional.",
        sender: "advisor",
      }),
      null,
    );
    assert.equal(classifyCompliance({ body: "My doctor changed my medication.", sender: "customer" }), null);
  });

  it("stops the reading only when the customer says they are under 18", () => {
    const own = classifyCompliance({ body: "I am 16", sender: "customer" });
    assert.equal(own?.category, "under_18");
    assert.equal(own?.risk, "high");
    assert.equal(own?.stopReading, true);
    assert.equal(own?.warning, UNDER18_WARNING);
    assert.equal(shouldBlockCompliance(own), true);
    assert.equal(classifyCompliance({ body: "I'm sixteen", sender: "customer" })?.stopReading, true);
    assert.equal(classifyCompliance({ body: "I am under 18", sender: "customer" })?.stopReading, true);
    assert.equal(classifyCompliance({ body: "My daughter is 16.", sender: "customer" }), null);
    assert.equal(classifyCompliance({ body: "My ex blocked me on Instagram.", sender: "customer" }), null);
    assert.equal(classifyCompliance({ body: "My ex blocked me on Facebook", sender: "customer" }), null);
    assert.equal(classifyCompliance({ body: "You said your ex blocked you on Facebook", sender: "advisor" }), null);
  });

  it("does not treat ordinary social-media stories as contact exchange", () => {
    for (const body of [
      "My ex blocked me on Facebook.",
      "I saw his TikTok yesterday.",
      "She posted a photo on Instagram.",
      "She posted something on TikTok",
      "He removed me from Snapchat.",
      "Do you think he checks my Facebook?",
      "My boyfriend follows his ex on Instagram.",
      "Can we talk on the phone about my job?",
      "Can I contact you tomorrow?",
      "I feel a strong signal from this connection.",
    ]) {
      const hit = classifyCompliance({ body, sender: "customer" });
      assert.notEqual(hit?.category, "off_platform", body);
      assert.notEqual(hit?.category, "personal_info", body);
    }
  });

  it("stores uncertain off-platform wording for review without blocking or suspending", () => {
    const hit = classifyCompliance({ body: "Maybe we should talk somewhere else later.", sender: "advisor" });
    assert.equal(hit?.category, "off_platform");
    assert.equal(hit?.block, false);
    assert.ok((hit?.confidence || 0) < 0.82);
    assert.equal(shouldBlockCompliance(hit), false);
    assert.equal("suspend" in (hit || {}), false);
  });
});

describe("compliance AI layer and report access", () => {
  it("does not block or punish when the AI classifier is uncertain", () => {
    const uncertain = applyAiClassification(
      null,
      { category: "sexual", risk: "high", confidence: 0.42, block: true },
      "advisor",
    );
    assert.equal(uncertain, null);
    const low = applyAiClassification(
      null,
      { category: "medical", risk: "high", confidence: 0.61, block: true },
      "advisor",
    );
    assert.equal(low?.block, false);
    assert.equal(low?.risk, "low");
    assert.equal(shouldBlockCompliance(low), false);
    const kept = classifyCompliance({ body: "my cell is 555 010 0199", sender: "advisor" });
    const overridden = applyAiClassification(kept, { category: "other", risk: "low", confidence: 0.99, block: false }, "advisor");
    assert.equal(overridden?.category, "personal_info");
    assert.equal(shouldBlockCompliance(overridden), true);
  });

  it("allows a very confident serious AI classification to block without suspending", () => {
    const hit = applyAiClassification(
      null,
      { category: "medical", risk: "high", confidence: 0.93, block: true },
      "advisor",
    );
    assert.equal(hit?.category, "medical");
    assert.equal(hit?.block, true);
    assert.equal(hit?.warning, MEDICAL_WARNING);
    assert.equal("suspend" in (hit || {}), false);
    assert.equal(shouldBlockCompliance(hit), true);
  });

  it("refuses AI Report Inbox access unless the account is an admin", () => {
    assert.equal(canReadAiReports(false), false);
    assert.equal(canReadAiReports(true), true);
    assert.equal(adminGate({ signedIn: true, admin: null, permission: "advisors" }).ok, false);
    assert.equal(adminGate({ signedIn: false, admin: { role: "owner", permissions: "*" }, permission: "advisors" }).ok, false);
    const allowed = adminGate({
      signedIn: true,
      profileStatus: "active",
      admin: { role: "owner", permissions: "*" },
      permission: "advisors",
    });
    assert.equal(allowed.ok, true);
  });

  it("filters reports by advisor, customer, category, risk, status, and date", () => {
    const row = {
      advisorName: "Mira Solane",
      advisorEmail: "mira@example.com",
      customerName: "Rowan Client",
      category: "medical",
      risk: "high",
      status: "new",
      at: "2026-09-20T15:00:00.000Z",
    };
    assert.equal(matchesAiReportFilters(row, { query: "mira@example.com" }), true);
    assert.equal(matchesAiReportFilters(row, { query: "rowan" }), true);
    assert.equal(matchesAiReportFilters(row, { query: "other" }), false);
    assert.equal(matchesAiReportFilters(row, { category: "medical", risk: "high", status: "new" }), true);
    assert.equal(matchesAiReportFilters(row, { category: "sexual" }), false);
    assert.equal(matchesAiReportFilters(row, { from: "2026-09-21" }), false);
    assert.equal(matchesAiReportFilters(row, { to: "2026-09-19" }), false);
  });

  it("uses only an explicit date of birth and never a name or writing style", () => {
    assert.equal(accountIsUnder18("2012-05-01", NOW), true);
    assert.equal(accountIsUnder18("2000-01-01", NOW), false);
    assert.equal(accountIsUnder18("2008-09-25", NOW), false);
    assert.equal(accountIsUnder18("2008-09-26", NOW), true);
    assert.equal(accountIsUnder18("", NOW), false);
    assert.equal(accountIsUnder18("not-a-date", NOW), false);
  });
});

describe("off-platform contact intent", () => {
  const blockedForBoth = [
    "Can I get your contact?",
    "How can I contact you outside of this?",
    "Can we talk somewhere else?",
    "Anywhere I can talk to you not here?",
    "Where can I message you privately?",
    "Can we chat outside Ora?",
    "Give me your socials",
    "Do you have Insta?",
    "Do you have Snapchat?",
    "What's your Facebook?",
    "Message me on TikTok",
    "Can we meet?",
    "Where can I meet you?",
    "Let's talk outside this app",
    "Send me your username",
    "How do I find you outside Ora?",
    "Do you have ig?",
    "Do you have snap?",
    "Do you have fb?",
    "Do you have wa?",
    "off app",
  ];

  it("blocks clear off-platform intent from both the customer and the advisor", () => {
    for (const body of blockedForBoth) {
      for (const sender of ["customer", "advisor"] as const) {
        const hit = classifyCompliance({ body, sender });
        assert.equal(shouldBlockCompliance(hit), true, `${sender}: ${body}`);
        assert.equal(hit?.stopReading, false, body);
        assert.equal("suspend" in (hit || {}), false);
        assert.ok(
          hit?.category === "OFF_PLATFORM_CONTACT_ATTEMPT" || hit?.category === "off_platform" || hit?.category === "personal_info",
          `${sender}: ${body} -> ${hit?.category}`,
        );
      }
    }
    const fresh = classifyCompliance({ body: "Give me your socials", sender: "customer" });
    assert.equal(fresh?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(fresh?.warning, OFF_PLATFORM_ATTEMPT_WARNING);
    const privately = classifyCompliance({ body: "Where can I message you privately?", sender: "advisor" });
    assert.equal(privately?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(privately?.warning, OFF_PLATFORM_ATTEMPT_WARNING);
    const contact = classifyCompliance({ body: "Can I get your contact?", sender: "advisor" });
    assert.equal(contact?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(contact?.warning, OFF_PLATFORM_ATTEMPT_WARNING);
    const chatOutside = classifyCompliance({ body: "Can we chat outside Ora?", sender: "customer" });
    assert.equal(chatOutside?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(chatOutside?.warning, OFF_PLATFORM_ATTEMPT_WARNING);
    const lets = classifyCompliance({ body: "Let's talk outside this app", sender: "advisor" });
    assert.equal(lets?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(lets?.warning, OFF_PLATFORM_ATTEMPT_WARNING);
    assert.equal(classifyCompliance({ body: "Can I have your number?", sender: "customer" })?.category, "personal_info");
    assert.equal(classifyCompliance({ body: "Can I have your number?", sender: "customer" })?.warning, CONTACT_WARNING);
    assert.equal(classifyCompliance({ body: "What's your Facebook?", sender: "customer" })?.category, "off_platform");
    assert.equal(classifyCompliance({ body: "Message me on TikTok", sender: "advisor" })?.category, "off_platform");
    assert.equal(classifyCompliance({ body: "Contact me outside Ora", sender: "customer" })?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
  });

  it("uses the conversation so a later location question is part of the attempt", () => {
    const recent = ["customer: Can I contact you?", "advisor: Sure", "customer: Outside this app?"];
    const outside = classifyCompliance({ body: "Outside this app?", sender: "customer" });
    assert.equal(outside?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(shouldBlockCompliance(outside), true);
    const where = classifyCompliance({ body: "Where do you live?", sender: "advisor", recent });
    assert.equal(where?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(shouldBlockCompliance(where), true);
    assert.equal(classifyCompliance({ body: "Sure", sender: "advisor", recent: ["customer: Can I contact you?"] }), null);
    assert.equal(classifyCompliance({ body: "Can I contact you?", sender: "customer" }), null);
  });

  it("lets a customer share their own location and blocks an advisor sharing theirs", () => {
    for (const body of ["I live in Karachi", "I'm from London", "I live in Pakistan", "My city is Manchester"]) {
      assert.equal(classifyCompliance({ body, sender: "customer" }), null, body);
      const advisor = classifyCompliance({ body, sender: "advisor" });
      assert.equal(advisor?.category, "OFF_PLATFORM_CONTACT_ATTEMPT", body);
      assert.equal(shouldBlockCompliance(advisor), true, body);
    }
    for (const body of [
      "I live near the station",
      "My address is 12 Main Street",
      "You can meet me at the cafe",
      "I work at the downtown shop",
      "Come meet me tonight",
      "Find me in Lahore",
    ]) {
      const advisor = classifyCompliance({ body, sender: "advisor" });
      assert.equal(shouldBlockCompliance(advisor), true, body);
      assert.equal(classifyCompliance({ body: "I live near my sister", sender: "customer" }), null);
    }
    assert.equal(classifyCompliance({ body: "Where do you live?", sender: "customer" })?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(classifyCompliance({ body: "Which city do you live in?", sender: "customer" })?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
    assert.equal(classifyCompliance({ body: "Where do you live?", sender: "advisor" }), null);
    assert.equal(classifyCompliance({ body: "Which city do you live in?", sender: "advisor" }), null);
    const afterMeet = classifyCompliance({
      body: "Where do you live?",
      sender: "advisor",
      recent: ["customer: Can we meet?"],
    });
    assert.equal(afterMeet?.category, "OFF_PLATFORM_CONTACT_ATTEMPT");
  });

  it("allows ordinary social and location talk that is not an exchange", () => {
    for (const body of [
      "My ex blocked me on Facebook",
      "She posted something on TikTok",
      "He lives in Karachi",
      "My boyfriend contacted me on Instagram",
      "Can I contact you tomorrow?",
      "Can we talk on the phone about my job?",
      "I feel a strong signal from this connection.",
    ]) {
      const hit = classifyCompliance({ body, sender: "customer" });
      assert.notEqual(hit?.category, "OFF_PLATFORM_CONTACT_ATTEMPT", body);
      assert.notEqual(hit?.category, "off_platform", body);
      assert.notEqual(hit?.category, "personal_info", body);
      assert.equal(shouldBlockCompliance(hit), false, body);
    }
    const soft = classifyCompliance({ body: "Maybe we should talk somewhere else later.", sender: "advisor" });
    assert.equal(soft?.category, "off_platform");
    assert.equal(soft?.block, false);
  });
});
