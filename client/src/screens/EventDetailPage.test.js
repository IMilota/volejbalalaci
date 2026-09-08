import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { UsersProvider } from "../users/UsersProvider";
import EventDetailPage from "./EventDetailPage";

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
  useAuth: jest.fn(),
}));

function mockUser(role = "user") {
  useAuth.mockReturnValue({
    user: { id: "u1", name: "Ivo", nickname: "ivo", role },
    token: "sess",
    status: "ready",
  });
}

afterEach(() => {
  api.mockReset();
});

test("RSVP 409 does not replace local attendance with the failed payload", async () => {
  mockUser();
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/users") {
      return Promise.resolve([{ id: "u1", name: "Ivo Milota", nickname: "ivo" }]);
    }
    if (path === "/api/events/e1") {
      return Promise.resolve({
        id: "e1",
        name: "Úterý",
        startAt: "2030-01-01T17:00:00.000Z",
        endAt: "2030-01-01T19:00:00.000Z",
        location: "Hala",
        capacity: 12,
        occupied: 12,
        status: "scheduled",
      });
    }
    if (path === "/api/events/e1/attendances") {
      return Promise.resolve([
        { id: "a1", userId: "u1", status: "maybe", guests: 0, note: "" },
      ]);
    }
    if (path === "/api/events/e1/attendances/me" && opts.method === "PUT") {
      return Promise.reject(
        new ApiError({
          code: "capacityExceeded",
          message: "capacity exceeded",
          status: 409,
        })
      );
    }
    return Promise.resolve({});
  });

  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/events/e1"]}
    >
      <UsersProvider>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </UsersProvider>
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByText("ivo")).toBeInTheDocument());
  expect(screen.queryByText("Ivo Milota")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Úterý" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Účastníci" })).toBeInTheDocument();
  expect(document.querySelector(".event-detail")).not.toBeNull();
  expect(document.querySelector(".event-detail .chat-compose")).not.toBeNull();
  expect(screen.queryByRole("heading", { name: "Moje účast" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Poznámka")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Moje účast" })).not.toBeInTheDocument();
  expect(screen.getByText("Kdy")).toBeInTheDocument();
  expect(screen.getByText("Kde")).toBeInTheDocument();
  expect(screen.getByText("Hala")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /otevřít účastníky.*12 \/ 12/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Nevím" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Jdu" })).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(screen.getByRole("button", { name: "Jdu" }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/kapacit/i));
  expect(screen.getByRole("button", { name: "Nevím" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Jdu" })).toHaveAttribute("aria-pressed", "false");
  expect(api).toHaveBeenCalledWith(
    "/api/events/e1/attendances/me",
    expect.objectContaining({
      method: "PUT",
      body: expect.objectContaining({ status: "yes" }),
    })
  );
});

test("RSVP yes sends guest increment on plus", async () => {
  mockUser();
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/users") {
      return Promise.resolve([{ id: "u1", name: "Ivo" }]);
    }
    if (path === "/api/events/e1") {
      return Promise.resolve({
        id: "e1",
        name: "Úterý",
        startAt: "2030-01-01T17:00:00.000Z",
        endAt: "2030-01-01T19:00:00.000Z",
        location: "Hala",
        capacity: 12,
        occupied: 1,
        status: "scheduled",
      });
    }
    if (path === "/api/events/e1/attendances") {
      return Promise.resolve([
        { id: "a1", userId: "u1", status: "yes", guests: 0, note: "" },
      ]);
    }
    if (path === "/api/events/e1/attendances/me" && opts.method === "PUT") {
      return Promise.resolve({
        id: "a1",
        userId: "u1",
        status: "yes",
        guests: opts.body.guests,
        note: "",
      });
    }
    return Promise.resolve({});
  });

  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/events/e1"]}
    >
      <UsersProvider>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </UsersProvider>
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByRole("group", { name: "Hosté" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Více hostů" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/api/events/e1/attendances/me",
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({ status: "yes", guests: 1 }),
      })
    )
  );
});

test("admin cancel opens a dialog and POSTs only after confirm", async () => {
  mockUser("admin");
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/users") {
      return Promise.resolve([{ id: "u1", name: "Ivo" }]);
    }
    if (path === "/api/events/e1") {
      return Promise.resolve({
        id: "e1",
        name: "Úterý",
        startAt: "2030-01-01T17:00:00.000Z",
        endAt: "2030-01-01T19:00:00.000Z",
        location: "Hala",
        capacity: 12,
        occupied: 1,
        status: "scheduled",
      });
    }
    if (path === "/api/events/e1/attendances") {
      return Promise.resolve([]);
    }
    if (path === "/api/events/e1/cancel" && opts.method === "POST") {
      return Promise.resolve({
        id: "e1",
        name: "Úterý",
        startAt: "2030-01-01T17:00:00.000Z",
        endAt: "2030-01-01T19:00:00.000Z",
        location: "Hala",
        capacity: 12,
        occupied: 1,
        status: "cancelled",
      });
    }
    return Promise.resolve([]);
  });

  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/events/e1"]}
    >
      <UsersProvider>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </UsersProvider>
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByRole("button", { name: "Zrušit" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent(/zrušit tento termín/i);
  const frame = dialog.querySelector(".modal-dialog") ?? dialog;
  expect(frame).toHaveClass("modal-vb-fit");
  expect(frame).toHaveClass("modal-dialog-scrollable");
  expect(api).not.toHaveBeenCalledWith("/api/events/e1/cancel", expect.anything());
  fireEvent.click(screen.getByRole("button", { name: "Zrušit termín" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/api/events/e1/cancel", { method: "POST" })
  );
});

test("unset attendance defaults to nejdu and guests stay disabled", async () => {
  mockUser();
  api.mockImplementation((path) => {
    if (path === "/api/users") {
      return Promise.resolve([{ id: "u1", name: "Ivo" }]);
    }
    if (path === "/api/events/e1") {
      return Promise.resolve({
        id: "e1",
        name: "Úterý",
        startAt: "2030-01-01T17:00:00.000Z",
        endAt: "2030-01-01T19:00:00.000Z",
        location: "Hala",
        capacity: 12,
        occupied: 0,
        status: "scheduled",
      });
    }
    if (path === "/api/events/e1/attendances") {
      return Promise.resolve([]);
    }
    return Promise.resolve({});
  });

  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/events/e1"]}
    >
      <UsersProvider>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </UsersProvider>
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByRole("button", { name: "Nejdu" })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Nejdu" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("group", { name: "Hosté" })).not.toBeInTheDocument();
});

test("admin can change another member's status but not guests", async () => {
  mockUser("admin");
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/users") {
      return Promise.resolve([
        { id: "u1", name: "Ivo" },
        { id: "u2", name: "Jana" },
        { id: "u3", name: "Petr" },
      ]);
    }
    if (path === "/api/events/e1") {
      return Promise.resolve({
        id: "e1",
        name: "Úterý",
        startAt: "2030-01-01T17:00:00.000Z",
        endAt: "2030-01-01T19:00:00.000Z",
        location: "Hala",
        capacity: 12,
        occupied: 1,
        status: "scheduled",
      });
    }
    if (path === "/api/events/e1/attendances") {
      return Promise.resolve([{ id: "a2", userId: "u2", status: "yes", guests: 2 }]);
    }
    if (path === "/api/events/e1/attendances/u3" && opts.method === "PUT") {
      return Promise.resolve({ id: "a3", userId: "u3", status: "yes", guests: 0 });
    }
    return Promise.resolve({});
  });

  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/events/e1"]}
    >
      <UsersProvider>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </UsersProvider>
    </MemoryRouter>
  );

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /otevřít účastníky/i })).toBeInTheDocument()
  );
  expect(screen.queryByText("Jana")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /otevřít účastníky/i }));
  const dialog = await screen.findByRole("dialog", { name: "Účastníci" });
  const frame = dialog.querySelector(".modal-dialog") ?? dialog;
  expect(frame).toHaveClass("modal-vb-fit");
  expect(frame).toHaveClass("modal-dialog-scrollable");
  expect(within(dialog).getByText("1 / 12")).toBeInTheDocument();
  expect(within(dialog).getByText("Ivo")).toBeInTheDocument();
  expect(within(dialog).getByText("Jana (+2)")).toBeInTheDocument();
  expect(within(dialog).getByText("Petr")).toBeInTheDocument();
  const names = within(dialog)
    .getAllByRole("listitem")
    .map((node) => node.querySelector(".event-attendee-name")?.textContent);
  expect(names[0]).toBe("Ivo");
  expect(names.indexOf("Jana (+2)")).toBeLessThan(names.indexOf("Petr"));
  expect(within(dialog).queryByLabelText("Jana: Hosté")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Petr: Jdu" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/api/events/e1/attendances/u3",
      expect.objectContaining({
        method: "PUT",
        body: { status: "yes" },
      })
    )
  );
});

test("non-admin cannot change another member's attendance", async () => {
  mockUser();
  api.mockImplementation((path) => {
    if (path === "/api/users") {
      return Promise.resolve([
        { id: "u1", name: "Ivo" },
        { id: "u2", name: "Jana" },
      ]);
    }
    if (path === "/api/events/e1") {
      return Promise.resolve({
        id: "e1",
        name: "Úterý",
        startAt: "2030-01-01T17:00:00.000Z",
        endAt: "2030-01-01T19:00:00.000Z",
        location: "Hala",
        capacity: 12,
        occupied: 1,
        status: "scheduled",
      });
    }
    if (path === "/api/events/e1/attendances") {
      return Promise.resolve([{ id: "a2", userId: "u2", status: "yes", guests: 0 }]);
    }
    return Promise.resolve({});
  });

  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/events/e1"]}
    >
      <UsersProvider>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </UsersProvider>
    </MemoryRouter>
  );

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /otevřít účastníky/i })).toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole("button", { name: /otevřít účastníky/i }));
  const dialog = await screen.findByRole("dialog", { name: "Účastníci" });
  expect(within(dialog).getByText("Ivo")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Jana: Jdu" })).not.toBeInTheDocument();
  expect(within(dialog).getByLabelText("Jana: Jdu")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Ivo: Jdu" })).toBeInTheDocument();
});
