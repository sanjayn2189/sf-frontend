"use client";

import { useState } from "react";
import { Check, Download } from "lucide-react";
import Button from "@/components/ui/Button";
import type { Contact } from "@/lib/contacts/types";
import { downloadVCard } from "@/lib/contacts/vcard";

export default function ExportVCardButton({ contact }: { contact: Contact }) {
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    downloadVCard(contact);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={handleExport}
      aria-label={`Export vCard for ${contact.full_name}`}
      className="inline-flex items-center gap-1.5 transition-all"
    >
      {exported ? (
        <>
          <Check className="h-4 w-4 text-emerald-500 animate-in zoom-in-50 duration-200" strokeWidth={2.5} aria-hidden="true" />
          <span className="text-emerald-500 font-medium">Exported!</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Export vCard
        </>
      )}
    </Button>
  );
}
