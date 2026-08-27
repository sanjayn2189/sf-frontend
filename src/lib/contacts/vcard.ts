import type { Contact } from "./types";

/**
 * Escapes text values according to RFC 6350 / vCard standard:
 * - Backslashes: \ -> \\
 * - Semicolons: ; -> \;
 * - Commas: , -> \,
 * - Newlines: \r\n, \n, \r -> \n (literal \n)
 */
export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/**
 * Folds a single vCard logical line into physical lines of at most 75 bytes,
 * using CRLF followed by a single space for continuation lines (RFC 2425 / RFC 6350).
 * Preserves multibyte character boundaries safely without splitting them.
 */
export function foldVCardLine(line: string, maxLength = 75): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= maxLength) {
    return line;
  }

  const chunks: string[] = [];
  let currentChunk = "";
  let currentByteLength = 0;
  let limit = maxLength;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (currentByteLength + charBytes > limit && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = char;
      currentByteLength = charBytes;
      limit = maxLength - 1; // Continuation lines have a 1-byte leading space
    } else {
      currentChunk += char;
      currentByteLength += charBytes;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.join("\r\n ");
}

/**
 * Generates an RFC 6350 / vCard 3.0 formatted string for a contact.
 * Includes line folding for long lines and trailing CRLF terminator.
 */
export function generateVCard(contact: Contact): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `PRODID:-//ContactApp//Contact Export//EN`,
  ];

  // Structured and Formatted Name
  const lastName = escapeVCardValue(contact.last_name || "");
  const firstName = escapeVCardValue(contact.first_name || "");
  lines.push(`N:${lastName};${firstName};;;`);

  const fullName = escapeVCardValue(
    contact.full_name || `${contact.first_name} ${contact.last_name}`.trim(),
  );
  lines.push(`FN:${fullName}`);

  // Email
  if (contact.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(contact.email.trim())}`);
  }

  // Phone
  if (contact.phone && contact.phone.trim()) {
    lines.push(`TEL;TYPE=CELL,VOICE:${escapeVCardValue(contact.phone.trim())}`);
  }

  // Organization & Job Title
  if (contact.company && contact.company.trim()) {
    lines.push(`ORG:${escapeVCardValue(contact.company.trim())}`);
  }

  if (contact.job_title && contact.job_title.trim()) {
    lines.push(`TITLE:${escapeVCardValue(contact.job_title.trim())}`);
  }

  // Addresses
  if (contact.addresses && contact.addresses.length > 0) {
    for (const addr of contact.addresses) {
      const type = (addr.type || "HOME").toUpperCase();
      const street = escapeVCardValue(addr.street || "");
      const city = escapeVCardValue(addr.city || "");
      const state = escapeVCardValue(addr.state || "");
      const zip = escapeVCardValue(addr.zip || "");

      // ADR format: ;;Street;City;State;Zip;Country
      lines.push(`ADR;TYPE=${type}:;;${street};${city};${state};${zip};`);
    }
  }

  // Notes
  if (contact.notes && contact.notes.trim()) {
    lines.push(`NOTE:${escapeVCardValue(contact.notes.trim())}`);
  }

  // Photo (Base64)
  if (contact.photo && contact.photo.trim()) {
    const photoMatch = contact.photo.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (photoMatch) {
      const rawType = photoMatch[1].toUpperCase();
      const photoType = rawType === "JPG" ? "JPEG" : rawType;
      const base64Data = photoMatch[2];
      lines.push(`PHOTO;ENCODING=b;TYPE=${photoType}:${base64Data}`);
    }
  }

  // Revision timestamp
  if (contact.updated_at) {
    lines.push(`REV:${contact.updated_at}`);
  }

  lines.push("END:VCARD");

  // Apply vCard line folding to every content line
  const foldedLines = lines.map((line) => foldVCardLine(line));
  return `${foldedLines.join("\r\n")}\r\n`;
}

/**
 * Generates a single vCard file containing multiple contacts.
 */
export function generateMultipleVCards(contacts: Contact[]): string {
  return contacts.map(generateVCard).join("\r\n");
}

/**
 * Triggers a browser download of the contact's vCard file.
 */
export function downloadVCard(contact: Contact): void {
  const vcard = generateVCard(contact);
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const cleanFirstName = (contact.first_name || "").trim().toLowerCase();
  const cleanLastName = (contact.last_name || "").trim().toLowerCase();
  const rawBaseName = `${cleanFirstName}_${cleanLastName}`.replace(/[^a-z0-9_-]+/g, "_");
  const filename = rawBaseName.replace(/^_+|_+$/g, "") || `contact_${contact.id}`;

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a browser download of all contacts in a single vCard file.
 */
export function downloadMultipleVCards(contacts: Contact[], filename = "contacts_export"): void {
  const vcards = generateMultipleVCards(contacts);
  const blob = new Blob([vcards], { type: "text/vcard;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
