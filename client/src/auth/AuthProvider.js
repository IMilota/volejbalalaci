import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, setOnUnauthorized } from "../api/client";
import { errorCopy } from "../api/error-copy";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("sessionToken"));
  const [status, setStatus] = useState(() =>
    localStorage.getItem("sessionToken") ? "loading" : "anon"
  );
  const [error, setError] = useState(null);
  const bootGenRef = useRef(0);

  const clearSession = useCallback(() => {
    localStorage.removeItem("sessionToken");
    setToken(null);
    setUser(null);
    setStatus("anon");
    setError(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized((failedToken) => {
      if (failedToken && localStorage.getItem("sessionToken") !== failedToken) {
        return;
      }
      clearSession();
      navigate("/login", { replace: true });
    });
    return () => setOnUnauthorized(null);
  }, [clearSession, navigate]);

  useEffect(() => {
    const stored = localStorage.getItem("sessionToken");
    if (!stored) {
      setStatus("anon");
      return undefined;
    }
    const bootGen = bootGenRef.current;
    let cancelled = false;
    (async () => {
      try {
        const me = await api("/api/me", { token: stored });
        if (cancelled || bootGen !== bootGenRef.current) {
          return;
        }
        if (localStorage.getItem("sessionToken") !== stored) {
          return;
        }
        setUser(me);
        setToken(stored);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (cancelled || bootGen !== bootGenRef.current) {
          return;
        }
        if (localStorage.getItem("sessionToken") !== stored) {
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          return;
        }
        setError(err instanceof ApiError ? err.message : errorCopy("network"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const requestChallenge = useCallback(async (email) => {
    await api("/api/auth/challenge", {
      method: "POST",
      body: { email },
      token: null,
    });
  }, []);

  const consumeToken = useCallback(async (challengeToken) => {
    const body = await api("/api/auth/consume", {
      method: "POST",
      body: { token: challengeToken },
      token: null,
    });
    bootGenRef.current += 1;
    localStorage.setItem("sessionToken", body.token);
    setToken(body.token);
    setUser(body.user);
    setStatus("ready");
    setError(null);
    return body;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await api("/api/auth/logout-all", { method: "POST" });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      status,
      error,
      requestChallenge,
      consumeToken,
      logout,
      logoutAll,
    }),
    [user, token, status, error, requestChallenge, consumeToken, logout, logoutAll]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
