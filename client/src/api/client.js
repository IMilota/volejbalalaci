import { errorCopy } from "./error-copy";

export class ApiError extends Error {
  constructor({ code, message, status }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.message = message;
    this.status = status;
  }
}

let onUnauthorized = null;

export function setOnUnauthorized(fn) {
  onUnauthorized = typeof fn === "function" ? fn : null;
}

export async function api(path, { method = "GET", body, token } = {}) {
  const sessionToken =
    token !== undefined ? token : localStorage.getItem("sessionToken");
  const headers = {};
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  let serialized;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    serialized = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: serialized,
    });
  } catch {
    throw new ApiError({
      code: "network",
      message: errorCopy("network"),
      status: 0,
    });
  }

  if (!res.ok) {
    let payload = {};
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }
    if (res.status === 401 && sessionToken && onUnauthorized) {
      onUnauthorized();
    }
    throw new ApiError({
      code: payload.code,
      message: errorCopy(payload.code, payload.message),
      status: res.status,
    });
  }

  return res.json();
}
