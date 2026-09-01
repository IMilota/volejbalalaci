function loadRegister() {
  let isolated;
  jest.isolateModules(() => {
    isolated = require("./registerServiceWorker");
  });
  return isolated;
}

beforeEach(() => {
  jest.resetModules();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: jest.fn().mockResolvedValue({}) },
  });
});

test("does not register until window load", () => {
  loadRegister();
  expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
});

test("registers /sw.js with scope / on load outside production", () => {
  loadRegister();
  window.dispatchEvent(new Event("load"));
  expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
});
