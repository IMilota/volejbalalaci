import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { clearStashedInstallPrompt } from "../pwa/installPromptCapture";
import AppShell from "./AppShell";

jest.mock("../auth/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../config/ConfigProvider", () => ({
  useConfig: jest.fn(),
}));

function mockPushEnvironment({ subscription = null } = {}) {
  const getSubscription = jest.fn().mockResolvedValue(subscription);
  const subscribe = jest.fn().mockResolvedValue(subscription);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription, subscribe },
      }),
    },
  });
  return { getSubscription, subscribe };
}

afterEach(() => {
  clearStashedInstallPrompt();
});

function renderShell(role, config = { instanceName: "Volejbalaláci", vapidPublicKey: null }) {
  useAuth.mockReturnValue({
    user: { id: "u1", name: "Ivo", nickname: "ivo", role },
    logout: jest.fn(),
    logoutAll: jest.fn(),
  });
  useConfig.mockReturnValue({ config });
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

test("without vapidPublicKey, Zapnout oznámení is absent", () => {
  renderShell("user", { instanceName: "Volejbalaláci", vapidPublicKey: null });
  expect(screen.queryByText(/zapnout oznámení/i)).not.toBeInTheDocument();
});

test("with vapidPublicKey and no subscription, Zapnout oznámení is present", async () => {
  mockPushEnvironment({ subscription: null });
  renderShell("user", { instanceName: "Volejbalaláci", vapidPublicKey: "fake-vapid-key" });
  expect(await screen.findByText(/zapnout oznámení/i)).toBeInTheDocument();
});

test("Nainstalovat is absent until beforeinstallprompt", () => {
  renderShell("user");
  expect(screen.queryByRole("button", { name: /nainstalovat/i })).not.toBeInTheDocument();
});

test("Nainstalovat appears when beforeinstallprompt fired before render", () => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  const event = new Event("beforeinstallprompt");
  event.prompt = jest.fn().mockResolvedValue(undefined);
  window.dispatchEvent(event);
  renderShell("user");
  expect(screen.getByRole("button", { name: /nainstalovat/i })).toBeInTheDocument();
});

test("Nainstalovat appears after beforeinstallprompt when not standalone", async () => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: query === "(display-mode: standalone)" ? false : false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  renderShell("user");
  const event = new Event("beforeinstallprompt");
  event.prompt = jest.fn().mockResolvedValue(undefined);
  await act(async () => {
    window.dispatchEvent(event);
  });
  expect(await screen.findByRole("button", { name: /nainstalovat/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /nainstalovat/i }));
  expect(event.prompt).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: /nainstalovat/i })).not.toBeInTheDocument()
  );
});
