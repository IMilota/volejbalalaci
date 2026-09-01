import { api, ApiError, setOnUnauthorized } from "./client";
import { errorCopy } from "./error-copy";

afterEach(() => {
  localStorage.clear();
  setOnUnauthorized(null);
  global.fetch = undefined;
});

test("api attaches Bearer from sessionToken and returns JSON", async () => {
  localStorage.setItem("sessionToken", "abc");
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "1" }),
  });
  const data = await api("/api/me");
  expect(data.id).toBe("1");
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/me",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer abc" }),
    })
  );
});

test("api throws ApiError with code from JSON body", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ code: "capacityExceeded", message: "full" }),
  });
  await expect(api("/api/x", { method: "PUT", body: {} })).rejects.toMatchObject({
    code: "capacityExceeded",
    status: 409,
  });
  expect(errorCopy("capacityExceeded")).toMatch(/kapacit/i);
});

test("api throws network ApiError when fetch rejects", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
  await expect(api("/api/me")).rejects.toMatchObject({
    code: "network",
    status: 0,
    message: errorCopy("network"),
  });
});

test("api calls onUnauthorized then throws on 401 when a token was sent", async () => {
  localStorage.setItem("sessionToken", "dead");
  const onUnauthorized = jest.fn();
  setOnUnauthorized(onUnauthorized);
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ code: "unauthorized", message: "invalid token" }),
  });
  await expect(api("/api/me")).rejects.toBeInstanceOf(ApiError);
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
});

test("api omits Bearer when token is null even if sessionToken is stored", async () => {
  localStorage.setItem("sessionToken", "abc");
  const onUnauthorized = jest.fn();
  setOnUnauthorized(onUnauthorized);
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ code: "unauthorized", message: "invalid token" }),
  });
  await expect(
    api("/api/auth/consume", { method: "POST", body: { token: "x" }, token: null })
  ).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  const [, options] = global.fetch.mock.calls[0];
  expect(options.headers.Authorization).toBeUndefined();
  expect(onUnauthorized).not.toHaveBeenCalled();
});
