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
  myStatus: null,
};

function renderList() {
  return render(
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
}

test("list card shows occupancy pill, not location", async () => {
  api.mockResolvedValue([existing]);
  renderList();
  await waitFor(() => expect(screen.getByText("Stávající")).toBeInTheDocument());
  expect(screen.queryByText("Hala")).not.toBeInTheDocument();
  expect(screen.getByText("0 / 12")).toBeInTheDocument();
  expect(screen.getByText("Moje účast")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /otevřít účastníky/i })).not.toBeInTheDocument();
});

test("create actions are icon buttons", async () => {
  api.mockResolvedValue([]);
  renderList();
  await waitFor(() => expect(screen.getByRole("button", { name: "Nová událost" })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Nová událost" })).toHaveAttribute("title", "Nová událost");
  expect(screen.getByRole("button", { name: "Nové události" })).toHaveAttribute("title", "Nové události");
  expect(screen.getByRole("button", { name: "Nová událost" })).not.toHaveTextContent("Nová událost");
  expect(screen.getByRole("button", { name: "Nové události" })).not.toHaveTextContent("Nové události");
});

test("RSVP on a card posts attendance and updates the pill without opening detail", async () => {
  let occupied = 0;
  let myStatus = null;
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/events/e1/attendances/me" && opts.method === "PUT") {
      myStatus = opts.body.status;
      occupied = opts.body.status === "yes" ? 1 : 0;
      return Promise.resolve({ id: "a1", userId: "u1", status: myStatus, guests: 0 });
    }
    if (path === "/api/events/e1") {
      return Promise.resolve({ ...existing, occupied, myStatus });
    }
    if (path === "/api/events") {
      return Promise.resolve([{ ...existing, occupied, myStatus }]);
    }
    return Promise.resolve({});
  });

  renderList();
  await waitFor(() => expect(screen.getByRole("button", { name: "Jdu" })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Nejdu" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: "Jdu" }));

  await waitFor(() => expect(screen.getByText("1 / 12")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Jdu" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText("detail")).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith(
    "/api/events/e1/attendances/me",
    expect.objectContaining({
      method: "PUT",
      body: expect.objectContaining({ status: "yes" }),
    })
  );
});

test("RSVP Nejdu is posted when attendance was never saved", async () => {
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/events/e1/attendances/me" && opts.method === "PUT") {
      return Promise.resolve({ id: "a1", userId: "u1", status: opts.body.status, guests: 0 });
    }
    if (path === "/api/events/e1") {
      return Promise.resolve({ ...existing, myStatus: "no" });
    }
    if (path === "/api/events") {
      return Promise.resolve([existing]);
    }
    return Promise.resolve({});
  });

  renderList();
  await waitFor(() => expect(screen.getByRole("button", { name: "Nejdu" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Nejdu" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/api/events/e1/attendances/me",
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({ status: "no" }),
      })
    )
  );
});

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
  fireEvent.change(within(dialog).getByLabelText("Den"), { target: { value: "3" } });
  fireEvent.change(within(dialog).getByLabelText("Od"), { target: { value: "2030-01-02" } });
  fireEvent.change(within(dialog).getByLabelText("Do"), { target: { value: "2030-01-02" } });
  fireEvent.change(within(dialog).getByLabelText("Začátek"), { target: { value: "17:00" } });
  fireEvent.change(within(dialog).getByLabelText("Konec"), { target: { value: "19:00" } });
  expect(within(dialog).getByText(/1 termín/i)).toBeInTheDocument();
  fireEvent.submit(within(dialog).getByLabelText("Název").closest("form"));

  await waitFor(() => expect(screen.getByText("Hromadný")).toBeInTheDocument());
  const eventGets = api.mock.calls.filter(
    ([path, opts = {}]) => path === "/api/events" && opts.method !== "POST"
  );
  expect(eventGets.length).toBeGreaterThanOrEqual(2);
});
