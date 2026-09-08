import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../api/client";
import BulkEventForm from "./BulkEventForm";

jest.mock("../api/client", () => ({
  api: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor({ code, message, status }) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

afterEach(() => {
  api.mockReset();
});

test("omits skipped preview dates from bulk POST", async () => {
  api.mockResolvedValue([]);
  const onHide = jest.fn();

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <BulkEventForm show onHide={onHide} />
    </MemoryRouter>
  );

  const dialog = screen.getByRole("dialog");
  const frame = dialog.querySelector(".modal-dialog") ?? dialog;
  expect(frame).toHaveClass("modal-vb-fit");
  expect(frame).toHaveClass("modal-dialog-scrollable");
  expect(frame.className).not.toMatch(/modal-fullscreen/);
  fireEvent.change(within(dialog).getByLabelText("Název"), { target: { value: "Trénink" } });
  fireEvent.change(within(dialog).getByLabelText("Místo"), { target: { value: "Hala" } });
  fireEvent.change(within(dialog).getByLabelText("Den"), { target: { value: "3" } });
  fireEvent.change(within(dialog).getByLabelText("Od"), { target: { value: "2030-01-02" } });
  fireEvent.change(within(dialog).getByLabelText("Do"), { target: { value: "2030-01-09" } });
  fireEvent.change(within(dialog).getByLabelText("Začátek"), { target: { value: "17:00" } });
  fireEvent.change(within(dialog).getByLabelText("Konec"), { target: { value: "19:00" } });

  expect(within(dialog).getByText("2 termíny")).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: /odebrat.*9\. 1\. 2030/i }));
  expect(within(dialog).getByText(/1 termín/)).toBeInTheDocument();

  fireEvent.submit(within(dialog).getByLabelText("Název").closest("form"));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/api/events/bulk",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          occurrences: [{ startAt: "2030-01-02T16:00:00.000Z", endAt: "2030-01-02T18:00:00.000Z" }],
        }),
      })
    )
  );
});
