"use client";

import { Download } from "lucide-react";
import Button from "@/components/ui/Button";
import type { Contact } from "@/lib/contacts/types";
import { downloadVCard } from "@/lib/contacts/vcard";

export default function ExportVCardButton({ contact }: { contact: Contact }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => downloadVCard(contact)}
      aria-label={`Export vCard for ${contact.full_name}`}
      className="inline-flex items-center gap-1.5"
    >
      <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      Export vCard
    </Button>
  );
}
