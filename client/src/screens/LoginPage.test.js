import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import LoginPage from "./LoginPage";

function Path() {
  const loc = useLocation();
  return <div>{loc.pathname}</div>;
}

function renderLogin(search = "") {
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[`/login${search}`]}
    >
      <AuthProvider>
        <Path />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  localStorage.clear();
  global.fetch = undefined;
});

test("consume stores session token and leaves /login", async () => {
  localStorage.clear();
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url === "/api/auth/consume") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          token: "sess-1",
          user: { id: "u1", name: "Ivo", nickname: "ivo", role: "admin" },
        }),
      });
    }
    if (url === "/api/me") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: "u1",
          name: "Ivo",
          nickname: "ivo",
          role: "admin",
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  renderLogin("?token=challenge-hex");
  await waitFor(() => expect(screen.getByText("/")).toBeInTheDocument());
  expect(localStorage.getItem("sessionToken")).toBe("sess-1");
  expect(screen.queryByText(/e-mail/i)).not.toBeInTheDocument();
});

test("expired sessionToken plus consume keeps the new session after delayed /api/me 401", async () => {
  localStorage.setItem("sessionToken", "expired");
  let finishMe;
  const mePending = new Promise((resolve) => {
    finishMe = resolve;
  });
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url === "/api/me") {
      return mePending.then(() => ({
        ok: false,
        status: 401,
        json: async () => ({ code: "unauthorized", message: "invalid token" }),
      }));
    }
    if (url === "/api/auth/consume") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          token: "sess-1",
          user: { id: "u1", name: "Ivo", nickname: "ivo", role: "admin" },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  renderLogin("?token=challenge-hex");
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer expired" }),
      })
    )
  );
  await waitFor(() => expect(localStorage.getItem("sessionToken")).toBe("sess-1"));
  await waitFor(() => expect(screen.getByText("/")).toBeInTheDocument());
  await act(async () => {
    finishMe();
  });
  expect(localStorage.getItem("sessionToken")).toBe("sess-1");
  expect(screen.getByText("/")).toBeInTheDocument();
  expect(screen.queryByText(/e-mail/i)).not.toBeInTheDocument();
});
