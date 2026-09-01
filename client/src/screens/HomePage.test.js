import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../api/client";
import HomePage from "./HomePage";

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

test("redirects to the nearest scheduled event when one exists", async () => {
  api.mockResolvedValue([
    { id: "evt-1", startAt: "2030-01-01T10:00:00.000Z", status: "scheduled" },
  ]);
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/"]}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:id" element={<div>event-evt-1</div>} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("event-evt-1")).toBeInTheDocument());
  expect(api).toHaveBeenCalledWith("/api/events");
});
