import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { UsersProvider } from "../users/UsersProvider";
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
      <UsersProvider>
        <UsersPage />
      </UsersProvider>
    </MemoryRouter>
  );
}

test("non-admin sees permission copy and not the table", async () => {
  setRole("user");
  api.mockResolvedValue([]);
  renderPage();
  expect(screen.getByText(/nemáš oprávnění/i)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await waitFor(() => expect(api).toHaveBeenCalledWith("/api/users"));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("admin sees members as cards, not a table", async () => {
  setRole("admin");
  api.mockResolvedValue([adminUser, memberUser]);
  renderPage();
  await waitFor(() => expect(screen.getByText("Ivo")).toBeInTheDocument());
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("ivo")).toBeInTheDocument();
  expect(screen.getByText("ivo@x.cz")).toBeInTheDocument();
  expect(screen.getByText("Alena")).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith("/api/users");
});

test("account type is an icon next to edit, not a text line", async () => {
  setRole("admin");
  api.mockResolvedValue([adminUser, memberUser]);
  renderPage();
  await waitFor(() => expect(screen.getByText("ivo@x.cz")).toBeInTheDocument());
  const adminCard = screen.getByText("ivo@x.cz").closest(".member-card");
  const memberCard = screen.getByText("alena@x.cz").closest(".member-card");
  expect(within(adminCard).getByRole("img", { name: "správce" })).toBeInTheDocument();
  expect(within(memberCard).getByRole("img", { name: "člen" })).toBeInTheDocument();
  expect(within(adminCard).queryByText("správce")).not.toBeInTheDocument();
  expect(within(memberCard).queryByText("člen")).not.toBeInTheDocument();
  const tools = adminCard.querySelector(".event-header-tools");
  const roleIcon = within(adminCard).getByRole("img", { name: "správce" });
  const edit = within(adminCard).getByRole("button", { name: /upravit/i });
  expect(tools.contains(roleIcon)).toBe(true);
  expect(tools.contains(edit)).toBe(true);
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
  const frame = dialog.querySelector(".modal-dialog") ?? dialog;
  expect(frame).toHaveClass("modal-vb-fit");
  expect(frame).toHaveClass("modal-dialog-scrollable");
  expect(frame.className).not.toMatch(/modal-fullscreen/);
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
  const card = screen.getByText("alena@x.cz").closest(".member-card");
  fireEvent.click(within(card).getByRole("button", { name: /upravit/i }));
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
  const adminCard = screen.getByText("ivo@x.cz").closest(".member-card");
  fireEvent.click(within(adminCard).getByRole("button", { name: /upravit/i }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("Role")).toBeDisabled();
});

test("has no delete user control", async () => {
  setRole("admin");
  api.mockResolvedValue([adminUser, memberUser]);
  renderPage();
  await waitFor(() => expect(screen.getByText("Ivo")).toBeInTheDocument());
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
