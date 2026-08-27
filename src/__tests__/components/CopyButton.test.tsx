import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CopyButton from "@/components/ui/CopyButton";

describe("CopyButton", () => {
  it("copies text to clipboard and displays copied confirmation", async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<CopyButton value="ada@example.com" label="Copy email" />);

    const button = screen.getByRole("button", { name: /copy email/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(writeTextMock).toHaveBeenCalledWith("ada@example.com");

    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
