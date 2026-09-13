import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "migrations");

describe("ora_applications runtime insert", () => {
  it("saves a pending row and lists it for admin", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const name of files) {
      await pg.exec(readFileSync(join(dir, name), "utf8"));
    }
    await pg.query(
      `insert into ora_applications (
        id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, status,
        legal_name, languages, years, email, phone, country, availability
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,'English',$11,$12,$13,$14,$15)`,
      [
        "app_test_owner",
        "user_test_owner",
        "Ora Owner",
        "Owner applying as advisor for runtime verification of pending applications.",
        "Desk review",
        "Tarot",
        20,
        "",
        "",
        "Owner Applicant",
        5,
        "oshamarif@gmail.com",
        "+1 555 0100",
        "PK",
        "Evenings",
      ],
    );
    const pending = await pg.query(
      "select email, status from ora_applications where status = 'pending' and email = $1",
      ["oshamarif@gmail.com"],
    );
    assert.equal(pending.rows.length, 1);
    assert.equal(pending.rows[0].status, "pending");
    const listed = await pg.query(
      `select id, name, email, status from ora_applications
       where status = 'pending' order by created_at desc limit 80`,
    );
    assert.ok(listed.rows.some((row) => row.email === "oshamarif@gmail.com"));
    await pg.close();
  });
});
