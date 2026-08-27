import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

/** Initials bubble, tinted with a hue derived from the contact's email, or photo avatar. */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email"> & {
    photo?: string | null;
  };
  size?: keyof typeof SIZES;
}) {
  if (contact.photo) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={contact.photo}
        alt={
          contact.first_name || contact.last_name
            ? `${contact.first_name} ${contact.last_name}`.trim()
            : "Contact photo"
        }
        className={`rounded-full aspect-square object-cover ${SIZES[size].split(" ")[0]} ${SIZES[size].split(" ")[1]}`}
      />
    );
  }

  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-semibold ${SIZES[size]}`}
    >
      {initials(contact)}
    </span>
  );
}
