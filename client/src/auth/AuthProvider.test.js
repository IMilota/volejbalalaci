import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthProvider";

afterEach(() => {
  localStorage.clear();
  global.fetch = undefined;
});

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <div>status:{auth.status}</div>
      <div>user:{auth.user?.id || ""}</div>
      <button type="button" onClick={() => auth.logout()}>
        Odhlásit
      </button>
    </div>
  );
}

function renderAuth() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>
  );
}

test("loads current user from sessionToken via GET /api/me", async () => {
  localStorage.setItem("sessionToken", "sess-1");
  global.fetch = jest.fn().mockImplementation((url) => {
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
  renderAuth();
  await waitFor(() => expect(screen.getByText("status:ready")).toBeInTheDocument());
  expect(screen.getByText("user:u1")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/me",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer sess-1" }),
    })
  );
});

test("logout posts /api/auth/logout and clears sessionToken", async () => {
  localStorage.setItem("sessionToken", "sess-1");
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url === "/api/me") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: "u1", name: "Ivo", nickname: "ivo", role: "user" }),
      });
    }
    if (url === "/api/auth/logout") {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  renderAuth();
  await waitFor(() => expect(screen.getByText("status:ready")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Odhlásit" }));
  await waitFor(() => expect(screen.getByText("status:anon")).toBeInTheDocument());
  expect(localStorage.getItem("sessionToken")).toBeNull();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/auth/logout",
    expect.objectContaining({ method: "POST" })
  );
});

test("network failure on GET /api/me does not clear sessionToken", async () => {
  localStorage.setItem("sessionToken", "sess-1");
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url === "/api/me") {
      return Promise.reject(new Error("offline"));
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  renderAuth();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/me", expect.anything()));
  expect(localStorage.getItem("sessionToken")).toBe("sess-1");
  expect(screen.queryByText("status:anon")).not.toBeInTheDocument();
});
