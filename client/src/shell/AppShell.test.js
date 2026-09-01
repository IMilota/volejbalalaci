import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import AppShell from "./AppShell";

jest.mock("../auth/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../config/ConfigProvider", () => ({
  useConfig: () => ({
    config: { instanceName: "Volejbalaláci", vapidPublicKey: null },
  }),
}));

function renderShell(role) {
  useAuth.mockReturnValue({
    user: { id: "u1", name: "Ivo", nickname: "ivo", role },
    logout: jest.fn(),
    logoutAll: jest.fn(),
  });
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell />
    </MemoryRouter>
  );
}

test("non-admin does not see Členové", () => {
  renderShell("user");
  expect(screen.queryByRole("link", { name: /členové/i })).not.toBeInTheDocument();
});

test("admin sees Členové", () => {
  renderShell("admin");
  expect(screen.getByRole("link", { name: /členové/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /členové/i })).toHaveAttribute("href", "/users");
});
