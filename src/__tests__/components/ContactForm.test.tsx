import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/components/contacts/ContactForm";
import { makeContact } from "../mocks/handlers";
import type { FormState } from "@/lib/contacts/types";

function renderForm(action: jest.Mock, contact?: ReturnType<typeof makeContact>) {
  return render(
    <ContactForm
      action={action as never}
      contact={contact}
      submitLabel="Create contact"
      cancelHref="/contacts"
    />,
  );
}

describe("ContactForm", () => {
  it("renders every editable field and add address button", () => {
    renderForm(jest.fn());

    expect(screen.getByLabelText(/first name/i)).toBeRequired();
    expect(screen.getByLabelText(/last name/i)).toBeRequired();
    expect(screen.getByLabelText(/^email/i)).toBeRequired();
    expect(screen.getByLabelText(/phone/i)).not.toBeRequired();
    expect(screen.getByLabelText(/notes/i).tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText(/^photo/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add address/i })).toBeInTheDocument();
  });

  it("prefills from an existing contact including photo and addresses", () => {
    const existingPhoto = "data:image/png;base64,samplephoto";
    renderForm(
      jest.fn(),
      makeContact({
        photo: existingPhoto,
        addresses: [
          {
            type: "Work",
            street: "1 Market St, Suite 400",
            city: "San Francisco",
            state: "CA",
            zip: "94105",
          },
        ],
      }),
    );

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("ada@example.com");
    expect(screen.getByAltText(/contact avatar preview/i)).toHaveAttribute("src", existingPhoto);
    expect(screen.getByDisplayValue("1 Market St, Suite 400")).toBeInTheDocument();
  });

  it("allows dynamically adding and filling an address", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    await userEvent.type(screen.getByLabelText(/first name/i), "Grace");
    await userEvent.type(screen.getByLabelText(/last name/i), "Hopper");
    await userEvent.type(screen.getByLabelText(/^email/i), "grace@example.com");

    // Add address
    await userEvent.click(screen.getByRole("button", { name: /add address/i }));

    const streetInput = screen.getByPlaceholderText(/1 market st/i);
    await userEvent.type(streetInput, "Pentagon Room 3E");

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));
    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    const addressesJson = formData.get("addresses_json") as string;
    const parsed = JSON.parse(addressesJson);
    expect(parsed.length).toBe(1);
    expect(parsed[0].street).toBe("Pentagon Room 3E");
    expect(parsed[0].type).toBe("Home");
  });

  it("preserves existing photo in PUT submit payload when editing name/email", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    const existingPhoto = "data:image/png;base64,preservedPhoto";
    renderForm(
      action,
      makeContact({
        photo: existingPhoto,
        addresses: [
          {
            type: "Work",
            street: "1 Market St",
            city: "San Francisco",
            state: "CA",
            zip: "94105",
          },
        ],
      }),
    );

    await userEvent.clear(screen.getByLabelText(/first name/i));
    await userEvent.type(screen.getByLabelText(/first name/i), "Augusta");
    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.get("first_name")).toBe("Augusta");
    expect(formData.get("photo")).toBe(existingPhoto);
    const addressesJson = formData.get("addresses_json") as string;
    expect(JSON.parse(addressesJson).length).toBe(1);
  });

  it("allows removing an existing photo", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    const existingPhoto = "data:image/png;base64,removablePhoto";
    renderForm(action, makeContact({ photo: existingPhoto }));

    const removeBtn = screen.getByRole("button", { name: /remove photo/i });
    await userEvent.click(removeBtn);

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.get("photo")).toBe("");
  });

  it("clears the file input value when removing a photo", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    const existingPhoto = "data:image/png;base64,removablePhoto";
    renderForm(action, makeContact({ photo: existingPhoto }));

    const fileInput = screen.getByLabelText(/^photo/i, { selector: "input" }) as HTMLInputElement;
    const file = new File(["dummy content"], "avatar.png", { type: "image/png" });

    // Set a file on the input
    await userEvent.upload(fileInput, file);

    // Remove photo
    const removeBtn = screen.getByRole("button", { name: /remove photo/i });
    await userEvent.click(removeBtn);

    // File input value should be cleared to empty string
    expect(fileInput.value).toBe("");

    // Reselecting the same file works without restriction
    await userEvent.upload(fileInput, file);
    expect(fileInput.files?.[0]).toBe(file);
  });

  it("shows the summary and the per-field errors the action returns", async () => {
    const action = jest.fn(
      async (): Promise<FormState> => ({
        status: "error",
        message: "That email address is already taken.",
        fieldErrors: { email: "This email is already in use." },
        values: { first_name: "Grace" },
      }),
    );
    renderForm(action);

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((node) => node.textContent)).toEqual(
      expect.arrayContaining([
        "That email address is already taken.",
        "This email is already in use.",
      ]),
    );
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("links back out without submitting", () => {
    renderForm(jest.fn());
    expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });
});

  it("displays nested address validation errors and sets aria-invalid", async () => {
    const action = jest.fn(
      async (): Promise<FormState> => ({
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: {
          "addresses.0.street": "Street must be 300 characters or fewer",
          "addresses.0.zip": "Postal code must be 20 characters or fewer",
        },
        values: {
          first_name: "Ada",
          addresses: [
            {
              type: "Home",
              street: "Too long street",
              city: "San Francisco",
              state: "CA",
              zip: "123456789012345678901",
            },
          ],
        },
      }),
    );
    renderForm(
      action,
      makeContact({
        addresses: [
          {
            type: "Home",
            street: "Too long street",
            city: "San Francisco",
            state: "CA",
            zip: "123456789012345678901",
          },
        ],
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    const streetError = await screen.findByText("Street must be 300 characters or fewer");
    expect(streetError).toBeInTheDocument();

    const zipError = await screen.findByText("Postal code must be 20 characters or fewer");
    expect(zipError).toBeInTheDocument();

    expect(screen.getByPlaceholderText(/1 market st/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByPlaceholderText(/94105/i)).toHaveAttribute("aria-invalid", "true");
  });
