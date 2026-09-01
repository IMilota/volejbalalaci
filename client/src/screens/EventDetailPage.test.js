import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api, ApiError } from "../api/client";
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
  useAuth: () => ({
    user: { id: "u1", name: "Ivo", nickname: "ivo", role: "user" },
    token: "sess",
    status: "ready",
  }),
}));

afterEach(() => {
  api.mockReset();
});

test("RSVP 409 does not replace local attendance with the failed payload", async () => {
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

  await waitFor(() => expect(screen.getByText("Ivo")).toBeInTheDocument());
  const ivoRow = screen.getByText("Ivo").closest("li");
  expect(ivoRow).toHaveTextContent(/možná/i);

  fireEvent.click(screen.getByRole("button", { name: "Ano" }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/kapacit/i));
  expect(screen.getByText("Ivo").closest("li")).toHaveTextContent(/možná/i);
  expect(screen.getByText("Ivo").closest("li")).not.toHaveTextContent(/^ano$/i);
  expect(api).toHaveBeenCalledWith(
    "/api/events/e1/attendances/me",
    expect.objectContaining({
      method: "PUT",
      body: expect.objectContaining({ status: "yes" }),
    })
  );
});
