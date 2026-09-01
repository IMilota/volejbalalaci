import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import UsersPage from "./UsersPage";

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

afterEach(() => {
  api.mockReset();
});

function setRole(role) {
  useAuth.mockReturnValue({
    user: { id: "u1", name: "Ivo", nickname: "ivo", role },
    token: "sess",
    status: "ready",
  });
}

const adminUser = {
  id: "u1",
  name: "Ivo",
  nickname: "ivo",
  email: "ivo@x.cz",
  role: "admin",
};

const memberUser = {
  id: "u2",
  name: "Alena",
  nickname: "alena",
  email: "alena@x.cz",
  role: "user",
};

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <UsersPage />
    </MemoryRouter>
  );
}

test("non-admin sees permission copy and not the table", () => {
  setRole("user");
  renderPage();
  expect(screen.getByText(/nemáš oprávnění/i)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

test("admin sees member table", async () => {
  setRole("admin");
  api.mockResolvedValue([adminUser, memberUser]);
  renderPage();
  await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  expect(screen.getByText("Ivo")).toBeInTheDocument();
  expect(screen.getByText("ivo")).toBeInTheDocument();
  expect(screen.getByText("ivo@x.cz")).toBeInTheDocument();
  expect(screen.getByText("Alena")).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith("/api/users");
});

test("admin can create a member", async () => {
  setRole("admin");
  let list = [adminUser];
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/users" && opts.method === "POST") {
      const created = {
        id: "u3",
        name: opts.body.name,
        nickname: opts.body.nickname,
        email: opts.body.email,
        role: opts.body.role || "user",
      };
      list = [...list, created];
      return Promise.resolve(created);
    }
    if (path === "/api/users") {
      return Promise.resolve(list);
    }
    return Promise.resolve({});
  });
  renderPage();
  await waitFor(() => expect(screen.getByText("Ivo")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /nový člen/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Jméno"), { target: { value: "Nový" } });
  fireEvent.change(within(dialog).getByLabelText("Přezdívka"), { target: { value: "novy" } });
  fireEvent.change(within(dialog).getByLabelText("E-mail"), { target: { value: "novy@x.cz" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Vytvořit" }));
  await waitFor(() => expect(screen.getByText("Nový")).toBeInTheDocument());
  expect(api).toHaveBeenCalledWith(
    "/api/users",
    expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({
        name: "Nový",
        nickname: "novy",
        email: "novy@x.cz",
      }),
    })
  );
});

test("admin can edit a member", async () => {
  setRole("admin");
  let list = [adminUser, memberUser];
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/users/u2" && opts.method === "PATCH") {
      const updated = { ...memberUser, ...opts.body };
      list = [adminUser, updated];
      return Promise.resolve(updated);
    }
    if (path === "/api/users") {
      return Promise.resolve(list);
    }
    return Promise.resolve({});
  });
  renderPage();
  await waitFor(() => expect(screen.getByText("Alena")).toBeInTheDocument());
  const row = screen.getByText("alena@x.cz").closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /upravit/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Jméno"), { target: { value: "Alena Nová" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Uložit" }));
  await waitFor(() => expect(screen.getByText("Alena Nová")).toBeInTheDocument());
  expect(api).toHaveBeenCalledWith(
    "/api/users/u2",
    expect.objectContaining({
      method: "PATCH",
      body: expect.objectContaining({ name: "Alena Nová" }),
    })
  );
});

test("409 on create shows mapped Czech copy", async () => {
  setRole("admin");
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/users" && opts.method === "POST") {
      return Promise.reject(
        new ApiError({
          code: "emailAlreadyExists",
          message: "email exists",
          status: 409,
        })
      );
    }
    if (path === "/api/users") {
      return Promise.resolve([adminUser]);
    }
    return Promise.resolve({});
  });
  renderPage();
  await waitFor(() => expect(screen.getByText("Ivo")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /nový člen/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Jméno"), { target: { value: "Nový" } });
  fireEvent.change(within(dialog).getByLabelText("Přezdívka"), { target: { value: "novy" } });
  fireEvent.change(within(dialog).getByLabelText("E-mail"), { target: { value: "ivo@x.cz" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Vytvořit" }));
  await waitFor(() =>
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/e-mail už existuje/i)
  );
});

test("last remaining admin cannot be demoted", async () => {
  setRole("admin");
  api.mockResolvedValue([adminUser, memberUser]);
  renderPage();
  await waitFor(() => expect(screen.getByText("Ivo")).toBeInTheDocument());
  const adminRow = screen.getByText("ivo@x.cz").closest("tr");
  fireEvent.click(within(adminRow).getByRole("button", { name: /upravit/i }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("Role")).toBeDisabled();
});

test("has no delete user control", async () => {
  setRole("admin");
  api.mockResolvedValue([adminUser, memberUser]);
  renderPage();
  await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /smazat|odebrat/i })).not.toBeInTheDocument();
});

test("GET 403 shows permission copy not the table", async () => {
  setRole("admin");
  api.mockRejectedValue(
    new ApiError({ code: "forbidden", message: "forbidden", status: 403 })
  );
  renderPage();
  await waitFor(() => expect(screen.getByText(/nemáš oprávnění/i)).toBeInTheDocument());
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
