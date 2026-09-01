import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useConfig } from "../config/ConfigProvider";
import { api, ApiError } from "../api/client";
import { usePushSubscription } from "./usePushSubscription";

jest.mock("../config/ConfigProvider", () => ({
  useConfig: jest.fn(),
}));

jest.mock("../api/client", () => {
  const actual = jest.requireActual("../api/client");
  return {
    ...actual,
    api: jest.fn(),
  };
});

const SUB_JSON = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "p", auth: "a" },
};

function fakeSubscription(overrides = {}) {
  return {
    endpoint: SUB_JSON.endpoint,
    toJSON: () => SUB_JSON,
    unsubscribe: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockPushEnvironment({ subscription = null, subscribeImpl } = {}) {
  const getSubscription = jest.fn().mockResolvedValue(subscription);
  const subscribe = jest.fn().mockImplementation(
    subscribeImpl || (() => Promise.resolve(subscription || fakeSubscription()))
  );
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription, subscribe },
      }),
    },
  });
  global.Notification = {
    requestPermission: jest.fn().mockResolvedValue("granted"),
  };
  return { getSubscription, subscribe };
}

function Probe() {
  const { canEnable, canDisable, enable, disable } = usePushSubscription();
  return (
    <div>
      <div>canEnable:{String(canEnable)}</div>
      <div>canDisable:{String(canDisable)}</div>
      <button type="button" onClick={() => enable()}>
        enable
      </button>
      <button type="button" onClick={() => disable()}>
        disable
      </button>
    </div>
  );
}

function renderHookView(vapidPublicKey) {
  useConfig.mockReturnValue({
    config: { instanceName: "Volejbalaláci", vapidPublicKey },
  });
  return render(<Probe />);
}

afterEach(() => {
  api.mockReset();
  delete global.Notification;
});

test("without vapidPublicKey, canEnable is false", async () => {
  mockPushEnvironment({ subscription: null });
  renderHookView(null);
  await waitFor(() => expect(screen.getByText("canEnable:false")).toBeInTheDocument());
  expect(screen.getByText("canDisable:false")).toBeInTheDocument();
});

test("with vapidPublicKey and no subscription, canEnable is true", async () => {
  mockPushEnvironment({ subscription: null });
  renderHookView("fake-vapid-key");
  await waitFor(() => expect(screen.getByText("canEnable:true")).toBeInTheDocument());
  expect(screen.getByText("canDisable:false")).toBeInTheDocument();
});

test("enable requests permission, subscribes, and POSTs subscription JSON", async () => {
  const { subscribe } = mockPushEnvironment({ subscription: null });
  api.mockResolvedValue({ ok: true });
  renderHookView("AAAA");
  await waitFor(() => expect(screen.getByText("canEnable:true")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "enable" }));
  await waitFor(() => expect(screen.getByText("canDisable:true")).toBeInTheDocument());
  expect(global.Notification.requestPermission).toHaveBeenCalledTimes(1);
  expect(subscribe).toHaveBeenCalledWith(
    expect.objectContaining({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    })
  );
  expect(api).toHaveBeenCalledWith("/api/push/subscribe", {
    method: "POST",
    body: SUB_JSON,
  });
  expect(screen.getByText("canEnable:false")).toBeInTheDocument();
});

test("503 pushNotConfigured leaves canEnable false", async () => {
  mockPushEnvironment({ subscription: null });
  api.mockRejectedValue(
    new ApiError({ code: "pushNotConfigured", message: "nope", status: 503 })
  );
  renderHookView("AAAA");
  await waitFor(() => expect(screen.getByText("canEnable:true")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "enable" }));
  await waitFor(() => expect(screen.getByText("canEnable:false")).toBeInTheDocument());
  expect(screen.getByText("canDisable:false")).toBeInTheDocument();
});

test("disable DELETEs endpoint then unsubscribes", async () => {
  const sub = fakeSubscription();
  mockPushEnvironment({ subscription: sub });
  api.mockResolvedValue({ ok: true });
  renderHookView("AAAA");
  await waitFor(() => expect(screen.getByText("canDisable:true")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "disable" }));
  await waitFor(() => expect(screen.getByText("canDisable:false")).toBeInTheDocument());
  expect(api).toHaveBeenCalledWith("/api/push/subscribe", {
    method: "DELETE",
    body: { endpoint: SUB_JSON.endpoint },
  });
  expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  expect(screen.getByText("canEnable:true")).toBeInTheDocument();
});
