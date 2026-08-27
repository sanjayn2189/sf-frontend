import {
  CONTACT_FIELDS,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import type { ContactInput } from "@/lib/contacts/types";

function values(overrides: Partial<ContactInput> = {}): ContactInput {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    notes: "",
    photo: "",
    addresses: [],
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.photo).toBeNull();
    expect(parsed.addresses).toEqual([]);
  });

  it("preserves a valid base64 photo data URL and typed addresses", () => {
    const photoData =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const parsed = contactInputSchema.parse(
      values({
        photo: photoData,
        addresses: [
          {
            type: "Home",
            street: "123 Main St",
            city: "San Francisco",
            state: "CA",
            zip: "94105",
          },
        ],
      }),
    );
    expect(parsed.photo).toBe(photoData);
    expect(parsed.addresses.length).toBe(1);
    expect(parsed.addresses[0].type).toBe("Home");
  });

  it("trims what the user typed", () => {
    expect(
      contactInputSchema.parse(values({ company: "  Acme  " })).company,
    ).toBe("Acme");
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(
      values({ email: "not-an-email" }),
    );
    expect(zodFieldErrors(result.error!).email).toBe(
      "Enter a valid email address",
    );
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
    });
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", async () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const { values: extracted } = await formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(extracted.addresses).toEqual([]);
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "addresses"].sort(),
    );
  });

  it("parses progressive-enhancement indexed address controls from form data", async () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.append("address_index", "0");
    formData.append("address_index", "1");

    formData.set("address_0_type", "Work");
    formData.set("address_0_street", "Pentagon Room 3E");
    formData.set("address_0_city", "Arlington");
    formData.set("address_0_state", "VA");
    formData.set("address_0_zip", "20301");

    formData.set("address_1_type", "Home");
    formData.set("address_1_street", "100 Main St");
    formData.set("address_1_city", "New York");
    formData.set("address_1_state", "NY");
    formData.set("address_1_zip", "10001");

    const { values: extracted } = await formDataToValues(formData);
    expect(extracted.addresses.length).toBe(2);
    expect(extracted.addresses[0]).toEqual({
      type: "Work",
      street: "Pentagon Room 3E",
      city: "Arlington",
      state: "VA",
      zip: "20301",
    });
    expect(extracted.addresses[1]).toEqual({
      type: "Home",
      street: "100 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
    });
  });

  it("parses addresses_json from form data when no indexed fields present", async () => {
    const formData = new FormData();
    formData.set("first_name", "Ada");
    formData.set(
      "addresses_json",
      JSON.stringify([
        {
          type: "Work",
          street: "1 Market St",
          city: "SF",
          state: "CA",
          zip: "94105",
        },
      ]),
    );

    const { values: extracted, addressesError } =
      await formDataToValues(formData);
    expect(addressesError).toBeUndefined();
    expect(extracted.addresses.length).toBe(1);
    expect(extracted.addresses[0].street).toBe("1 Market St");
  });

  it("returns an error for malformed addresses_json and does not clear addresses silently", async () => {
    const formData = new FormData();
    formData.set("first_name", "Ada");
    formData.set("addresses_json", "{invalid json");

    const { addressesError } = await formDataToValues(formData);
    expect(addressesError).toBe("Failed to parse address data.");
  });

  it("returns an error if addresses_json is not an array", async () => {
    const formData = new FormData();
    formData.set("first_name", "Ada");
    formData.set("addresses_json", JSON.stringify({ type: "Home" }));

    const { addressesError } = await formDataToValues(formData);
    expect(addressesError).toBe("Invalid address format.");
  });

  it("converts a direct file upload into a base64 data URL when no photo string is present", async () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    const mockFile = {
      size: 18,
      type: "image/png",
      arrayBuffer: async () => Buffer.from("sample image bytes"),
    };
    formData.get = jest.fn((name: string) => {
      if (name === "photo_file") return mockFile as unknown as File;
      if (name === "first_name") return "Grace";
      return null;
    });

    const { values: extracted, photoError } = await formDataToValues(formData);
    expect(photoError).toBeUndefined();
    expect(extracted.photo).toMatch(/^data:image\/png;base64,/);
  });

  it("returns an error for files exceeding the 2MB size limit", async () => {
    const formData = new FormData();
    const oversizedFile = {
      size: 3 * 1024 * 1024,
      type: "image/png",
      arrayBuffer: async () => Buffer.from(""),
    };
    formData.get = jest.fn((name: string) => {
      if (name === "photo_file") return oversizedFile as unknown as File;
      return null;
    });

    const { photoError } = await formDataToValues(formData);
    expect(photoError).toBe("Photo must be 2MB or smaller.");
  });

  it("returns an error for unsupported file MIME types", async () => {
    const formData = new FormData();
    const pdfFile = {
      size: 500,
      type: "application/pdf",
      arrayBuffer: async () => Buffer.from(""),
    };
    formData.get = jest.fn((name: string) => {
      if (name === "photo_file") return pdfFile as unknown as File;
      return null;
    });

    const { photoError } = await formDataToValues(formData);
    expect(photoError).toBe("Photo must be a JPG, PNG, GIF, or WebP image.");
  });

  it("prefers client-resized photo value over raw photo_file in hydrated submissions", async () => {
    const resizedDataUrl = "data:image/jpeg;base64,resizedClientPhotoData";
    const rawFile = {
      size: 2_000_000,
      type: "image/png",
      arrayBuffer: async () => Buffer.from("large unresized image bytes"),
    };

    const formData = new FormData();
    formData.get = jest.fn((name: string) => {
      if (name === "photo") return resizedDataUrl;
      if (name === "photo_file") return rawFile as unknown as File;
      if (name === "first_name") return "Grace";
      return null;
    });

    const { values: extracted, photoError } = await formDataToValues(formData);
    expect(photoError).toBeUndefined();
    expect(extracted.photo).toBe(resizedDataUrl);
  });
});
