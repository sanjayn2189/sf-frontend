import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Pencil } from "lucide-react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import DeleteContactButton from "@/components/contacts/DeleteContactButton";
import ExportVCardButton from "@/components/contacts/ExportVCardButton";
import CopyButton from "@/components/ui/CopyButton";
import { buttonClasses } from "@/components/ui/Button";
import { getContact } from "@/lib/contacts/api";
import { formatTimestamp, jobLine } from "@/lib/contacts/format";

type PageProps = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) notFound();
  return id;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const contact = await getContact(parseId((await params).id));
  return {
    title: contact?.full_name ?? "Contact not found",
    description: contact ? jobLine(contact) ?? undefined : undefined,
  };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-hairline px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4 items-center">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground flex items-center gap-2 flex-wrap">
        {children ?? <span className="text-muted-foreground/50">—</span>}
      </dd>
    </div>
  );
}

export default async function ContactDetailPage({ params }: PageProps) {
  const contact = await getContact(parseId((await params).id));
  if (!contact) notFound();

  const subtitle = jobLine(contact);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        All contacts
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ContactAvatar contact={contact} size="lg" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {contact.full_name}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportVCardButton contact={contact} />
          <Link
            href={`/contacts/${contact.id}/edit`}
            className={buttonClasses("secondary")}
          >
            <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Edit
          </Link>
          <DeleteContactButton
            contactId={contact.id}
            contactName={contact.full_name}
            redirectToList
            variant="danger"
            size="md"
            withLabel
          />
        </div>
      </header>

      <dl className="rounded-lg border border-border bg-card">
        <Row label="Email">
          <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
            {contact.email}
          </a>
          <CopyButton value={contact.email} label="Copy email" />
        </Row>
        <Row label="Phone">
          {contact.phone ? (
            <>
              <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                {contact.phone}
              </a>
              <CopyButton value={contact.phone} label="Copy phone" />
            </>
          ) : null}
        </Row>
        <Row label="Company">{contact.company}</Row>
        <Row label="Job title">{contact.job_title}</Row>
        <Row label="Addresses">
          {contact.addresses && contact.addresses.length > 0 ? (
            <div className="w-full space-y-3">
              {contact.addresses.map((addr, idx) => {
                const query = [
                  addr.street,
                  addr.city,
                  addr.state,
                  addr.zip,
                ]
                  .filter(Boolean)
                  .join(", ");
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

                return (
                  <div
                    key={addr.id ?? idx}
                    className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2.5 rounded-md border border-border/60 bg-muted/20 p-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="inline-flex items-center self-start rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
                        {addr.type}
                      </span>
                      <div className="text-sm text-foreground">
                        {addr.street ? <div className="font-medium">{addr.street}</div> : null}
                        <div className="text-muted-foreground">
                          {[
                            addr.city,
                            [addr.state, addr.zip].filter(Boolean).join(" "),
                          ]
                            .filter(Boolean)
                            .join(", ") || (addr.street ? "" : "—")}
                        </div>
                      </div>
                    </div>

                    {query ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary hover:underline self-end sm:self-center"
                      >
                        <span>View map</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </Row>
        <Row label="Notes">
          {contact.notes ? (
            <span className="whitespace-pre-wrap">{contact.notes}</span>
          ) : null}
        </Row>
      </dl>

      <dl className="rounded-lg border border-border bg-card/50 text-[13px]">
        <Row label="ID">
          <span className="font-mono">{contact.id}</span>
        </Row>
        <Row label="Created">
          <span className="font-mono">{formatTimestamp(contact.created_at)}</span>
        </Row>
        <Row label="Last updated">
          <span className="font-mono">{formatTimestamp(contact.updated_at)}</span>
        </Row>
      </dl>
    </div>
  );
}
