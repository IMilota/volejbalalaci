import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import UsersPage from "../screens/UsersPage";
import { UsersProvider, useUsers } from "./UsersProvider";

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

function setAdmin() {
  useAuth.mockReturnValue({
    user: { id: "u1", name: "Ivo", nickname: "ivo", role: "admin" },
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

function CacheProbe() {
  const { users, displayName } = useUsers();
  return (
    <div>
      <div data-testid="user-names">{users.map((item) => item.name).join("|")}</div>
      <div data-testid="label-u2">{displayName("u2")}</div>
      <div data-testid="label-u3">{displayName("u3")}</div>
    </div>
  );
}

function renderWithCache() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <UsersProvider>
        <CacheProbe />
        <UsersPage />
      </UsersProvider>
    </MemoryRouter>
  );
}

test("creating a member updates users cache without remounting the provider", async () => {
  setAdmin();
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

  renderWithCache();
  await waitFor(() => expect(screen.getByTestId("user-names")).toHaveTextContent("Ivo"));
  expect(screen.getByTestId("label-u3")).toHaveTextContent("u3");

  fireEvent.click(screen.getByRole("button", { name: /nový člen/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Jméno"), { target: { value: "Nový" } });
  fireEvent.change(within(dialog).getByLabelText("Přezdívka"), { target: { value: "novy" } });
  fireEvent.change(within(dialog).getByLabelText("E-mail"), { target: { value: "novy@x.cz" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Vytvořit" }));

  await waitFor(() => expect(screen.getByTestId("user-names")).toHaveTextContent("Ivo|Nový"));
  expect(screen.getByTestId("label-u3")).toHaveTextContent("Nový");
});

test("editing a member updates displayName without remounting the provider", async () => {
  setAdmin();
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

  renderWithCache();
  await waitFor(() => expect(screen.getByTestId("label-u2")).toHaveTextContent("Alena"));

  const row = screen.getByText("alena@x.cz").closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /upravit/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Jméno"), { target: { value: "Alena Nová" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Uložit" }));

  await waitFor(() => expect(screen.getByTestId("label-u2")).toHaveTextContent("Alena Nová"));
  expect(screen.getByTestId("user-names")).toHaveTextContent("Ivo|Alena Nová");
});
