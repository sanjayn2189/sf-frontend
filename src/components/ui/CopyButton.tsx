"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy } from "lucide-react";

export default function CopyButton({
  value,
  label = "Copy to clipboard",
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleCopy = async () => {
    // 1. Try modern Clipboard API
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(value);
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 1500);
        return;
      } catch {
        // Fallback to legacy execCommand on rejection
      }
    }

    // 2. Fallback via hidden textarea and document.execCommand
    try {
      if (typeof document !== "undefined" && typeof document.execCommand === "function") {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        textarea.setAttribute("readonly", "");
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (successful) {
          setStatus("copied");
          setTimeout(() => setStatus("idle"), 1500);
          return;
        }
      }
    } catch {
      // Fallback failed
    }

    // 3. User-visible failure state if both methods fail
    setStatus("error");
    setTimeout(() => setStatus("idle"), 2000);
  };

  const getAriaLabel = () => {
    if (status === "copied") return "Copied";
    if (status === "error") return "Failed to copy";
    return label;
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={getAriaLabel()}
      title={status === "error" ? "Failed to copy" : status === "copied" ? "Copied!" : label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${
        status === "error"
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground"
      }`}
    >
      {status === "copied" ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 animate-in zoom-in-50 duration-150" strokeWidth={2.5} />
      ) : status === "error" ? (
        <AlertCircle className="h-3.5 w-3.5 text-destructive animate-in zoom-in-50 duration-150" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
    </button>
  );
}
