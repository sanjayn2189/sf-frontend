import {
  generateVCard,
  generateMultipleVCards,
  escapeVCardValue,
  foldVCardLine,
  downloadVCard,
  downloadMultipleVCards,
} from "@/lib/contacts/vcard";
import type { Contact } from "@/lib/contacts/types";

const mockContact: Contact = {
  id: 42,
  first_name: "Ada",
  last_name: "Lovelace",
  full_name: "Ada Lovelace",
  email: "ada@analytical.engine",
  phone: "+1-415-555-0100",
  company: "Analytical Engines, Inc.",
  job_title: "Lead Mathematician; Programmer",
  notes: "First programmer in history.\nNotes: works with Charles Babbage.",
  photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  addresses: [
    {
      id: 1,
      contact_id: 42,
      type: "Home",
      street: "12 Ockham Park",
      city: "Surrey",
      state: "England",
      zip: "GU23 6NP",
    },
    {
      id: 2,
      contact_id: 42,
      type: "Work",
      street: "10 St James's Square",
      city: "London",
      state: "Greater London",
      zip: "SW1Y 4LE",
    },
  ],
  created_at: "2026-08-01T12:00:00Z",
  updated_at: "2026-08-02T15:30:00Z",
};

describe("vcard generator", () => {
  it("escapes special characters according to RFC 6350", () => {
    expect(escapeVCardValue("Hello; World, How\\Are\nYou?")).toBe(
      "Hello\\; World\\, How\\\\Are\\nYou?",
    );
  });

  it("folds long lines at 75 octets using CRLF and whitespace", () => {
    const longLine = "NOTE:" + "A".repeat(150);
    const folded = foldVCardLine(longLine);

    const physicalLines = folded.split("\r\n");
    expect(physicalLines.length).toBe(3);
    expect(physicalLines[0].length).toBe(75);
    expect(physicalLines[1].startsWith(" ")).toBe(true);
    expect(physicalLines[1].length).toBe(75);
    expect(physicalLines[2].startsWith(" ")).toBe(true);

    // Unfolding reconstructs the exact original logical line
    const unfolded = folded.replace(/\r\n /g, "");
    expect(unfolded).toBe(longLine);
  });

  it("folds long lines with multibyte unicode characters without splitting characters", () => {
    // Emojis and CJK characters (3-4 bytes each)
    const unicodeLine = "NOTE:" + "✨ 🚀 こんにちは 世界 ".repeat(10);
    const folded = foldVCardLine(unicodeLine);

    const physicalLines = folded.split("\r\n");
    expect(physicalLines.length).toBeGreaterThan(1);
    for (let i = 1; i < physicalLines.length; i++) {
      expect(physicalLines[i].startsWith(" ")).toBe(true);
    }

    // Verify all physical lines are <= 75 bytes
    const encoder = new TextEncoder();
    for (const pLine of physicalLines) {
      expect(encoder.encode(pLine).length).toBeLessThanOrEqual(75);
    }

    // Unfolding preserves exact unicode string
    const unfolded = folded.replace(/\r\n /g, "");
    expect(unfolded).toBe(unicodeLine);
  });

  it("escapes phone values containing newlines and reserved characters", () => {
    const contactWithMultilinePhone: Contact = {
      ...mockContact,
      phone: "+1-415-555-0100\r\next. 123;456,789",
    };

    const vcard = generateVCard(contactWithMultilinePhone);
    expect(vcard).toContain("TEL;TYPE=CELL,VOICE:+1-415-555-0100\\next. 123\\;456\\,789");
  });

  it("generates a complete folded vCard 3.0 string with photo and ends with CRLF", () => {
    const vcard = generateVCard(mockContact);

    expect(vcard).toContain("BEGIN:VCARD\r\n");
    expect(vcard).toContain("VERSION:3.0\r\n");
    expect(vcard).toContain("N:Lovelace;Ada;;;\r\n");
    expect(vcard).toContain("FN:Ada Lovelace\r\n");
    expect(vcard).toContain("EMAIL;TYPE=INTERNET:ada@analytical.engine\r\n");
    expect(vcard).toContain("TEL;TYPE=CELL,VOICE:+1-415-555-0100\r\n");
    expect(vcard).toContain("ORG:Analytical Engines\\, Inc.\r\n");
    expect(vcard).toContain("TITLE:Lead Mathematician\\; Programmer\r\n");
    expect(vcard).toContain("NOTE:First programmer in history.\\nNotes: works with Charles Babbage.\r\n");
    expect(vcard).toContain("ADR;TYPE=HOME:;;12 Ockham Park;Surrey;England;GU23 6NP;\r\n");
    expect(vcard).toContain("ADR;TYPE=WORK:;;10 St James's Square;London;Greater London;SW1Y 4LE;\r\n");
    expect(vcard).toContain("PHOTO;ENCODING=b;TYPE=PNG:");
    expect(vcard).toContain("REV:2026-08-02T15:30:00Z\r\n");
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);

    // Unfolded vCard contains the full base64 data unbroken
    const unfolded = vcard.replace(/\r\n /g, "");
    expect(unfolded).toContain(
      "PHOTO;ENCODING=b;TYPE=PNG:iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    );
  });

  it("generates multiple vCards in a single string", () => {
    const multi = generateMultipleVCards([mockContact, mockContact]);
    const count = (multi.match(/BEGIN:VCARD/g) || []).length;
    expect(count).toBe(2);
  });

  it("handles minimal contacts gracefully without optional fields and ends with CRLF", () => {
    const minimalContact: Contact = {
      id: 1,
      first_name: "Alan",
      last_name: "Turing",
      full_name: "Alan Turing",
      email: "alan@bletchley.park",
      phone: null,
      company: null,
      job_title: null,
      notes: null,
      photo: null,
      addresses: [],
      created_at: "2026-08-01T12:00:00Z",
      updated_at: "2026-08-01T12:00:00Z",
    };

    const vcard = generateVCard(minimalContact);

    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("VERSION:3.0");
    expect(vcard).toContain("N:Turing;Alan;;;");
    expect(vcard).toContain("FN:Alan Turing");
    expect(vcard).toContain("EMAIL;TYPE=INTERNET:alan@bletchley.park");
    expect(vcard).not.toContain("TEL;");
    expect(vcard).not.toContain("ORG:");
    expect(vcard).not.toContain("TITLE:");
    expect(vcard).not.toContain("ADR;");
    expect(vcard).not.toContain("PHOTO;");
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);
  });

  it("triggers browser download with formatted filename", () => {
    const createObjectURLMock = jest.fn(() => "blob:http://localhost/dummy-url");
    const revokeObjectURLMock = jest.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    const appendChildSpy = jest.spyOn(document.body, "appendChild");
    const removeChildSpy = jest.spyOn(document.body, "removeChild");

    downloadVCard(mockContact);
    downloadMultipleVCards([mockContact], "all_contacts");

    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(appendChildSpy).toHaveBeenCalledTimes(2);
    expect(removeChildSpy).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/dummy-url");

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
