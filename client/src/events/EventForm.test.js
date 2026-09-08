import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../api/client";
import EventForm from "./EventForm";

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

const existing = {
  id: "e1",
  name: "Úterý",
  startAt: "2030-01-01T17:00:00.000Z",
  endAt: "2030-01-01T19:00:00.000Z",
  location: "Hala",
  capacity: 12,
  description: "Starý popis",
};

function renderForm(props = {}) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EventForm show onHide={() => {}} {...props} />
    </MemoryRouter>
  );
}

test("edit with empty description PATCHes description as empty string", async () => {
  api.mockResolvedValue({ ...existing, description: "" });
  renderForm({ event: existing });

  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Popis"), { target: { value: "" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Uložit" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/api/events/e1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.objectContaining({ description: "" }),
      })
    )
  );
});

test("create omits empty description", async () => {
  api.mockResolvedValue({ id: "e2", name: "Nová" });
  renderForm();

  const dialog = await screen.findByRole("dialog");
  const frame = dialog.querySelector(".modal-dialog") ?? dialog;
  expect(frame).toHaveClass("modal-vb-fit");
  expect(frame).toHaveClass("modal-dialog-scrollable");
  fireEvent.change(within(dialog).getByLabelText("Název"), { target: { value: "Nová" } });
  fireEvent.change(within(dialog).getByLabelText("Začátek"), {
    target: { value: "2030-01-08T18:00" },
  });
  fireEvent.change(within(dialog).getByLabelText("Konec"), {
    target: { value: "2030-01-08T20:00" },
  });
  fireEvent.change(within(dialog).getByLabelText("Místo"), { target: { value: "Hala" } });
  fireEvent.change(within(dialog).getByLabelText("Kapacita"), { target: { value: "12" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Vytvořit" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({ method: "POST" })
    )
  );
  const post = api.mock.calls.find(([path, opts]) => path === "/api/events" && opts?.method === "POST");
  expect(post[1].body).not.toHaveProperty("description");
});
