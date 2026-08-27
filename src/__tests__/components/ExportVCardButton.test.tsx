import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportVCardButton from "@/components/contacts/ExportVCardButton";
import { downloadVCard } from "@/lib/contacts/vcard";
import { makeContact } from "../mocks/handlers";

jest.mock("@/lib/contacts/vcard", () => ({
  downloadVCard: jest.fn(),
  generateVCard: jest.fn(),
}));

describe("ExportVCardButton", () => {
  it("renders export button and triggers download on click", async () => {
    const contact = makeContact({
      first_name: "Ada",
      last_name: "Lovelace",
      full_name: "Ada Lovelace",
    });

    render(<ExportVCardButton contact={contact} />);

    const button = screen.getByRole("button", { name: /export vcard for ada lovelace/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(downloadVCard).toHaveBeenCalledWith(contact);
  });
});
