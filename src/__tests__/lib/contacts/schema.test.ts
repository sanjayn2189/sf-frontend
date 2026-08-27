import {
  CONTACT_FIELDS,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";

function values(overrides: Record<string, string> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    notes: "",
    photo: "",
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
  });

  it("preserves a valid base64 photo data URL", () => {
    const photoData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const parsed = contactInputSchema.parse(values({ photo: photoData }));
    expect(parsed.photo).toBe(photoData);
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
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
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), postal_code: "9".repeat(21) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      postal_code: "Postal code must be 20 characters or fewer",
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
    expect(Object.keys(extracted).sort()).toEqual(
      CONTACT_FIELDS.map((field) => field.name).sort(),
    );
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
