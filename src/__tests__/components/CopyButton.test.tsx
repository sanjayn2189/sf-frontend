import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CopyButton from "@/components/ui/CopyButton";

describe("CopyButton", () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    document.execCommand = originalExecCommand;
  });

  it("copies text via Clipboard API and displays copied confirmation", async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CopyButton value="ada@example.com" label="Copy email" />);

    const button = screen.getByRole("button", { name: /copy email/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(writeTextMock).toHaveBeenCalledWith("ada@example.com");

    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("falls back to execCommand when Clipboard API rejects", async () => {
    const writeTextMock = jest.fn().mockRejectedValue(new Error("Permission denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const execCommandMock = jest.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    render(<CopyButton value="ada@example.com" label="Copy email" />);

    await userEvent.click(screen.getByRole("button", { name: /copy email/i }));

    expect(writeTextMock).toHaveBeenCalled();
    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("falls back to execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const execCommandMock = jest.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    render(<CopyButton value="ada@example.com" label="Copy email" />);

    await userEvent.click(screen.getByRole("button", { name: /copy email/i }));

    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("displays error state when both Clipboard API and fallback fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn().mockRejectedValue(new Error("Failed")) },
      writable: true,
      configurable: true,
    });

    document.execCommand = jest.fn().mockReturnValue(false);

    render(<CopyButton value="ada@example.com" label="Copy email" />);

    await userEvent.click(screen.getByRole("button", { name: /copy email/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /failed to copy/i })).toBeInTheDocument();
    });
  });
});
