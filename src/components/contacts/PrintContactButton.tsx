"use client";

import { Printer } from "lucide-react";
import Button from "@/components/ui/Button";

export default function PrintContactButton({ name }: { name: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.print();
        }
      }}
      aria-label={`Print contact profile for ${name}`}
      className="print:hidden inline-flex items-center gap-1.5"
    >
      <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      Print
    </Button>
  );
}
