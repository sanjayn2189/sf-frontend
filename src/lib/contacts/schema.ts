import { z } from "zod";
import type { Address, AddressType, ContactInput } from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

export const MAX_PHOTO_SOURCE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

export const addressSchema = z.object({
  id: z.number().int().positive().safe().optional(),
  contact_id: z.number().int().positive().safe().optional(),
  type: z.enum(["Home", "Work", "Other"]).default("Home"),
  street: optionalText(300, "Street"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  zip: optionalText(20, "Postal code"),
});

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  photo: z
    .string()
    .trim()
    .max(3_000_000, "Photo must be 2MB or smaller")
    .transform((value) => value || null)
    .nullable()
    .default(null),
  addresses: z.array(addressSchema).default([]),
}) satisfies z.ZodType<ContactInput, unknown>;

export type ContactFormValues = z.input<typeof contactInputSchema>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(
  error: z.ZodError,
): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface ContactFieldSpec {
  name: keyof Omit<ContactInput, "addresses">;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "file";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "photo",
        label: "Photo",
        type: "file",
        maxLength: 3_000_000,
        placeholder: "Upload photo",
        wide: true,
      },
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

export interface FormDataValuesResult {
  values: ContactInput;
  photoError?: string;
  addressesError?: string;
}

/** Pull the contact fields out of a submitted form, converting direct file uploads to base64 and parsing addresses. */
export async function formDataToValues(
  formData: FormData,
): Promise<FormDataValuesResult> {
  const rawFields = Object.fromEntries(
    CONTACT_FIELDS.map((field) => {
      const val = formData.get(field.name);
      return [field.name, typeof val === "string" ? val : ""];
    }),
  ) as Record<keyof Omit<ContactInput, "addresses">, string>;

  // Progressive enhancement: extract indexed address inputs first
  const addressIndices = formData.getAll("address_index");
  let addresses: Address[] = [];
  let addressesError: string | undefined;

  if (addressIndices.length > 0) {
    const seenIndices = new Set<string>();

    for (const idxVal of addressIndices) {
      if (typeof idxVal !== "string") {
        addressesError = "Invalid address index format.";
        break;
      }
      const idx = idxVal.trim();
      if (!idx || !/^\d+$/.test(idx)) {
        addressesError = "Invalid address index.";
        break;
      }
      if (seenIndices.has(idx)) {
        addressesError = "Duplicate address index.";
        break;
      }
      seenIndices.add(idx);

      const typeVal = formData.get(`address_${idx}_type`);
      if (typeVal !== null && typeof typeVal !== "string") {
        addressesError = "Invalid address type format.";
        break;
      }

      let type: AddressType;
      if (typeVal === null || typeVal.trim() === "") {
        type = "Home";
      } else if (
        typeVal.trim() === "Home" ||
        typeVal.trim() === "Work" ||
        typeVal.trim() === "Other"
      ) {
        type = typeVal.trim() as AddressType;
      } else {
        addressesError = "Invalid address type. Expected Home, Work, or Other.";
        break;
      }

      const extractString = (field: string): string | null | false => {
        const val = formData.get(`address_${idx}_${field}`);
        if (val === null) return null;
        if (typeof val !== "string") return false;
        const trimmed = val.trim();
        return trimmed || null;
      };

      const street = extractString("street");
      const city = extractString("city");
      const state = extractString("state");
      const zip = extractString("zip");

      if (street === false || city === false || state === false || zip === false) {
        addressesError = "Invalid address field value.";
        break;
      }

      const idVal = formData.get(`address_${idx}_id`);
      let id: number | undefined;
      if (idVal !== null) {
        if (typeof idVal !== "string") {
          addressesError = "Invalid address id format.";
          break;
        }
        const trimmedId = idVal.trim();
        if (trimmedId !== "") {
          if (!/^[1-9]\d*$/.test(trimmedId) || !Number.isSafeInteger(Number(trimmedId))) {
            addressesError = "Invalid address id.";
            break;
          }
          id = Number(trimmedId);
        }
      }

      addresses.push({
        ...(id !== undefined ? { id } : {}),
        type,
        street,
        city,
        state,
        zip,
      });
    }
  } else {
    const addressesJson = formData.get("addresses_json");
    if (typeof addressesJson === "string" && addressesJson.trim()) {
      try {
        const parsed = JSON.parse(addressesJson);
        if (Array.isArray(parsed)) {
          let validJson = true;
          for (const item of parsed) {
            if (typeof item !== "object" || item === null) {
              validJson = false;
              break;
            }
            if ("id" in item && item.id !== undefined && item.id !== null) {
              if (
                typeof item.id !== "number" ||
                !Number.isSafeInteger(item.id) ||
                item.id <= 0
              ) {
                validJson = false;
                addressesError = "Invalid address id.";
                break;
              }
            }
          }
          if (validJson) {
            addresses = parsed as Address[];
          } else if (!addressesError) {
            addressesError = "Invalid address format.";
          }
        } else {
          addressesError = "Invalid address format.";
        }
      } catch {
        addressesError = "Failed to parse address data.";
      }
    }
  }

  const values: ContactInput = {
    ...rawFields,
    first_name: rawFields.first_name ?? "",
    last_name: rawFields.last_name ?? "",
    email: rawFields.email ?? "",
    phone: rawFields.phone ?? "",
    company: rawFields.company ?? "",
    job_title: rawFields.job_title ?? "",
    notes: rawFields.notes ?? "",
    photo: rawFields.photo ?? "",
    addresses,
  };

  let photoError: string | undefined;

  // Prefer client-processed resized photo value when available.
  // Fall back to direct binary file upload (`photo_file`) for no-JavaScript / pre-hydration submissions.
  const photoString =
    typeof formData.get("photo") === "string"
      ? (formData.get("photo") as string).trim()
      : "";

  if (photoString) {
    values.photo = photoString;
  } else {
    const photoFile = formData.get("photo_file");
    if (photoFile && typeof photoFile === "object" && "arrayBuffer" in photoFile) {
      const file = photoFile as Blob;
      if (file.size > 0) {
        if (file.size > MAX_PHOTO_SOURCE_BYTES) {
          photoError = "Photo must be 2MB or smaller.";
        } else if (file.type && !ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) {
          photoError = "Photo must be a JPG, PNG, GIF, or WebP image.";
        } else {
          const bytes = await file.arrayBuffer();
          const base64 = Buffer.from(bytes).toString("base64");
          const mimeType = file.type || "image/jpeg";
          values.photo = `data:${mimeType};base64,${base64}`;
        }
      }
    }
  }

  return { values, photoError, addressesError };
}
