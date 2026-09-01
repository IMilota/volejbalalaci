import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../api/client";
import EventListPage from "./EventListPage";

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

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Ivo", nickname: "ivo", role: "admin" },
    token: "sess",
    status: "ready",
  }),
}));

afterEach(() => {
  api.mockReset();
});

const existing = {
  id: "e1",
  name: "Stávající",
  startAt: "2030-01-01T17:00:00.000Z",
  endAt: "2030-01-01T19:00:00.000Z",
  location: "Hala",
  capacity: 12,
  occupied: 0,
  status: "scheduled",
};

const created = {
  id: "e2",
  name: "Hromadný",
  startAt: "2030-01-08T17:00:00.000Z",
  endAt: "2030-01-08T19:00:00.000Z",
  location: "Hala",
  capacity: 12,
  occupied: 0,
  status: "scheduled",
};

test("bulk success on the list page reloads events", async () => {
  let list = [existing];
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/events/bulk" && opts.method === "POST") {
      list = [existing, created];
      return Promise.resolve([created]);
    }
    if (path === "/api/events") {
      return Promise.resolve(list);
    }
    return Promise.resolve({});
  });

  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/events"]}
    >
      <Routes>
        <Route path="/events" element={<EventListPage />} />
        <Route path="/events/:id" element={<div>detail</div>} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByText("Stávající")).toBeInTheDocument());
  expect(screen.queryByText("Hromadný")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Nové události" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Název"), { target: { value: "Hromadný" } });
  fireEvent.change(within(dialog).getByLabelText("Místo"), { target: { value: "Hala" } });
  fireEvent.change(within(dialog).getByLabelText("Začátek"), {
    target: { value: "2030-01-08T17:00" },
  });
  fireEvent.change(within(dialog).getByLabelText("Konec"), {
    target: { value: "2030-01-08T19:00" },
  });
  fireEvent.submit(within(dialog).getByLabelText("Název").closest("form"));

  await waitFor(() => expect(screen.getByText("Hromadný")).toBeInTheDocument());
  const eventGets = api.mock.calls.filter(
    ([path, opts = {}]) => path === "/api/events" && opts.method !== "POST"
  );
  expect(eventGets.length).toBeGreaterThanOrEqual(2);
});
