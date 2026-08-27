import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrintContactButton from "@/components/contacts/PrintContactButton";

describe("PrintContactButton", () => {
  it("renders print button and calls window.print on click", async () => {
    const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});

    render(<PrintContactButton name="Ada Lovelace" />);

    const button = screen.getByRole("button", { name: /print contact profile for ada lovelace/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(printSpy).toHaveBeenCalled();

    printSpy.mockRestore();
  });
});
