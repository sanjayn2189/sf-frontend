"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Camera, Loader2, X } from "lucide-react";
import Field from "@/components/ui/Field";
import Button, { buttonClasses } from "@/components/ui/Button";
import { CONTACT_FIELD_GROUPS } from "@/lib/contacts/schema";
import {
  EMPTY_FORM_STATE,
  type Contact,
  type ContactInput,
  type FormState,
} from "@/lib/contacts/types";

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

/**
 * Create/edit form. The field list comes from `CONTACT_FIELD_GROUPS`, and the
 * action is a bound server action — so a submit is a plain POST that works
 * before hydration and reports errors through `useActionState`.
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

  const activePhoto =
    userPhoto !== undefined
      ? userPhoto
      : state.values?.photo !== undefined
        ? state.values.photo || null
        : (contact?.photo ?? null);

  function valueFor(name: keyof ContactInput): string {
    return state.values?.[name] ?? (contact?.[name] as string | undefined) ?? "";
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUserPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setUserPhoto(null);
  }

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

      {/* Hidden input to pass photo base64 string in form submission */}
      <input type="hidden" name="photo" value={activePhoto ?? ""} />

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
                        optional (JPG, PNG, GIF)
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
                          id="field-photo-input"
                          type="file"
                          accept="image/*"
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

                    {state.fieldErrors?.photo ? (
                      <p role="alert" className="mt-1 text-[13px] text-destructive">
                        {state.fieldErrors.photo}
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

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        <SubmitButton label={submitLabel} />
        <Link href={cancelHref} className={buttonClasses("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
