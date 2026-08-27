import {
  addressLine,
  avatarHue,
  formatAddress,
  formatTimestamp,
  initials,
  jobLine,
} from "@/lib/contacts/format";
import { makeContact } from "../../mocks/handlers";

describe("initials", () => {
  it("takes the first letter of each name in uppercase", () => {
    expect(initials({ first_name: "Ada", last_name: "Lovelace" })).toBe("AL");
    expect(initials({ first_name: "grace", last_name: "hopper" })).toBe("GH");
  });

  it("handles single-name inputs gracefully", () => {
    expect(initials({ first_name: "Cher", last_name: "" })).toBe("C");
  });
});

describe("avatarHue", () => {
  it("is deterministic for a given seed", () => {
    expect(avatarHue("ada@example.com")).toBe(avatarHue("ada@example.com"));
  });

  it("returns a value in [0, 360)", () => {
    const hue = avatarHue("test-seed");
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});

describe("formatTimestamp", () => {
  it("formats ISO timestamps in UTC", () => {
    expect(formatTimestamp("2026-08-19T17:04:53.743932Z")).toBe(
      "19 Aug 2026, 17:04 UTC",
    );
  });

  it("handles bad dates without throwing", () => {
    expect(formatTimestamp("not-a-date")).toBe("—");
  });
});

describe("jobLine", () => {
  it("combines title and company", () => {
    expect(
      jobLine(
        makeContact({ job_title: "Founder", company: "Babbage Engines" }),
      ),
    ).toBe("Founder at Babbage Engines");
  });

  it("falls back to title alone or company alone", () => {
    expect(jobLine(makeContact({ job_title: "CEO", company: null }))).toBe(
      "CEO",
    );
    expect(jobLine(makeContact({ job_title: null, company: "Acme" }))).toBe(
      "Acme",
    );
  });

  it("returns null when neither is set", () => {
    expect(
      jobLine(makeContact({ job_title: null, company: null })),
    ).toBeNull();
  });
});

describe("formatAddress and addressLine", () => {
  it("joins street, city, state, and zip", () => {
    expect(
      formatAddress({
        type: "Work",
        street: "1 Market St",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
      }),
    ).toBe("1 Market St, San Francisco, CA 94105");
  });

  it("returns null when there is no address at all", () => {
    expect(addressLine(makeContact({ addresses: [] }))).toBeNull();
  });
});
