"use client";

import { useActionState, useRef, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Camera, Loader2, Plus, Trash2, X } from "lucide-react";
import Field from "@/components/ui/Field";
import Button, { buttonClasses } from "@/components/ui/Button";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  CONTACT_FIELD_GROUPS,
  MAX_PHOTO_SOURCE_BYTES,
} from "@/lib/contacts/schema";
import {
  EMPTY_FORM_STATE,
  type Address,
  type AddressType,
  type Contact,
  type ContactInput,
  type FormState,
} from "@/lib/contacts/types";

const MAX_DIMENSION = 600; // Max width/height for avatar scaling

export type ContactFormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      {pending ? "Saving…" : label}
    </Button>
  );
}

function resizeImage(dataUrl: string, callback: (result: string) => void) {
  const img = new Image();
  img.onload = () => {
    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL("image/jpeg", 0.85));
        return;
      }
    }
    callback(dataUrl);
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
}

/**
 * Create/edit form. Dynamic address array and photo avatar support.
 * Supports progressive enhancement with server-side multipart conversion
 * and retains full PUT payload contracts.
 */
export default function ContactForm({
  action,
  contact,
  submitLabel,
  cancelHref,
}: {
  action: ContactFormAction;
  contact?: Contact;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const [userPhoto, setUserPhoto] = useState<string | null | undefined>(undefined);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Addresses state initialized from existing contact or empty array
  const [addresses, setAddresses] = useState<Address[]>(() => {
    if (state.values?.addresses && Array.isArray(state.values.addresses)) {
      return state.values.addresses;
    }
    return contact?.addresses ?? [];
  });

  const activeReadIdRef = useRef<number>(0);
  const activeReaderRef = useRef<FileReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePhoto =
    userPhoto !== undefined
      ? userPhoto
      : state.values?.photo !== undefined
        ? state.values.photo || null
        : (contact?.photo ?? null);

  function valueFor(name: keyof Omit<ContactInput, "addresses">): string {
    return (
      (state.values?.[name] as string | undefined) ??
      (contact?.[name] as string | undefined) ??
      ""
    );
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const currentReadId = ++activeReadIdRef.current;
    if (activeReaderRef.current) {
      activeReaderRef.current.abort();
      activeReaderRef.current = null;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PHOTO_SOURCE_BYTES) {
      setPhotoError("Photo must be 2MB or smaller.");
      e.target.value = "";
      return;
    }

    if (file.type && !ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) {
      setPhotoError("Photo must be a JPG, PNG, GIF, or WebP image.");
      e.target.value = "";
      return;
    }

    setPhotoError(null);
    const reader = new FileReader();
    activeReaderRef.current = reader;

    reader.onload = () => {
      if (currentReadId !== activeReadIdRef.current) return;
      activeReaderRef.current = null;
      if (typeof reader.result === "string") {
        resizeImage(reader.result, (scaled) => {
          if (currentReadId !== activeReadIdRef.current) return;
          setUserPhoto(scaled);
        });
      }
    };
    reader.onerror = () => {
      if (currentReadId !== activeReadIdRef.current) return;
      activeReaderRef.current = null;
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    ++activeReadIdRef.current;
    if (activeReaderRef.current) {
      activeReaderRef.current.abort();
      activeReaderRef.current = null;
    }
    setUserPhoto(null);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleAddAddress() {
    setAddresses((prev) => [
      ...prev,
      { type: "Home", street: "", city: "", state: "", zip: "" },
    ]);
  }

  function handleRemoveAddress(index: number) {
    setAddresses((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddressChange(
    index: number,
    field: keyof Omit<Address, "id" | "contact_id">,
    value: string,
  ) {
    setAddresses((prev) =>
      prev.map((addr, i) =>
        i === index ? { ...addr, [field]: value } : addr,
      ),
    );
  }

  const effectivePhotoError = photoError ?? state.fieldErrors?.photo;

  return (
    <form action={formAction} noValidate className="space-y-8">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-foreground"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{state.message}</span>
        </div>
      ) : null}

      {/* Hidden inputs to pass photo base64 and dynamic addresses array */}
      <input type="hidden" name="photo" value={activePhoto ?? ""} />
      <input
        type="hidden"
        name="addresses_json"
        value={JSON.stringify(addresses)}
      />

      {CONTACT_FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="space-y-4">
          <legend className="sr-only">{group.title}</legend>

          <div className="border-b border-hairline pb-2">
            <h2 className="font-display text-sm font-semibold text-foreground">
              {group.title}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {group.description}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => {
              if (field.name === "photo") {
                return (
                  <div key="field-photo" className="sm:col-span-2 space-y-2">
                    <label
                      htmlFor="field-photo-input"
                      className="block text-[13px] font-medium text-foreground"
                    >
                      {field.label}
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                        optional (JPG, PNG, GIF, WebP up to 2MB)
                      </span>
                    </label>

                    <div className="flex flex-wrap items-center gap-4">
                      {activePhoto ? (
                        <div className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={activePhoto}
                            alt="Contact avatar preview"
                            className="h-16 w-16 rounded-full aspect-square object-cover border border-border"
                          />
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            aria-label="Clear photo"
                            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted/40 text-muted-foreground">
                          <Camera className="h-6 w-6 stroke-[1.5]" aria-hidden="true" />
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <input
                          ref={fileInputRef}
                          id="field-photo-input"
                          name="photo_file"
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          aria-label="Photo"
                          onChange={handlePhotoChange}
                          className="block text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20 cursor-pointer"
                        />
                        {activePhoto ? (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="text-left text-xs text-destructive hover:underline"
                          >
                            Remove photo
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {effectivePhotoError ? (
                      <p role="alert" className="mt-1 text-[13px] text-destructive">
                        {effectivePhotoError}
                      </p>
                    ) : null}
                  </div>
                );
              }

              return (
                <Field
                  key={field.name}
                  field={field}
                  defaultValue={valueFor(field.name)}
                  error={state.fieldErrors?.[field.name]}
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      {/* Dynamic Addresses Section */}
      <fieldset className="space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-2">
          <div>
            <h2 className="font-display text-sm font-semibold text-foreground">
              Addresses
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Add multiple typed addresses (Home, Work, Other).
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddAddress}
          >
            <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Add Address
          </Button>
        </div>

        {addresses.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            No addresses added yet. Click &quot;Add Address&quot; above to add one.
          </p>
        ) : (
          <div className="space-y-4">
            {addresses.map((address, index) => (
              <div
                key={index}
                className="relative rounded-lg border border-border/80 bg-card p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2">
                  <span className="text-xs font-semibold text-foreground">
                    Address #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAddress(index)}
                    aria-label={`Remove address ${index + 1}`}
                    className="inline-flex items-center text-xs text-destructive hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`address-type-${index}`}
                      className="mb-1 block text-[13px] font-medium text-foreground"
                    >
                      Type
                    </label>
                    <select
                      id={`address-type-${index}`}
                      value={address.type}
                      onChange={(e) =>
                        handleAddressChange(
                          index,
                          "type",
                          e.target.value as AddressType,
                        )
                      }
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="Home">Home</option>
                      <option value="Work">Work</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label
                      htmlFor={`address-street-${index}`}
                      className="mb-1 block text-[13px] font-medium text-foreground"
                    >
                      Street address
                    </label>
                    <input
                      id={`address-street-${index}`}
                      type="text"
                      placeholder="1 Market St, Suite 400"
                      value={address.street ?? ""}
                      onChange={(e) =>
                        handleAddressChange(index, "street", e.target.value)
                      }
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`address-city-${index}`}
                      className="mb-1 block text-[13px] font-medium text-foreground"
                    >
                      City
                    </label>
                    <input
                      id={`address-city-${index}`}
                      type="text"
                      placeholder="San Francisco"
                      value={address.city ?? ""}
                      onChange={(e) =>
                        handleAddressChange(index, "city", e.target.value)
                      }
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`address-state-${index}`}
                      className="mb-1 block text-[13px] font-medium text-foreground"
                    >
                      State / region
                    </label>
                    <input
                      id={`address-state-${index}`}
                      type="text"
                      placeholder="CA"
                      value={address.state ?? ""}
                      onChange={(e) =>
                        handleAddressChange(index, "state", e.target.value)
                      }
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`address-zip-${index}`}
                      className="mb-1 block text-[13px] font-medium text-foreground"
                    >
                      Postal code
                    </label>
                    <input
                      id={`address-zip-${index}`}
                      type="text"
                      placeholder="94105"
                      value={address.zip ?? ""}
                      onChange={(e) =>
                        handleAddressChange(index, "zip", e.target.value)
                      }
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        <SubmitButton label={submitLabel} />
        <Link href={cancelHref} className={buttonClasses("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
