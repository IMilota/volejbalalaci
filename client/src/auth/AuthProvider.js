import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setOnUnauthorized } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("sessionToken"));
  const [status, setStatus] = useState(() =>
    localStorage.getItem("sessionToken") ? "loading" : "anon"
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem("sessionToken");
    setToken(null);
    setUser(null);
    setStatus("anon");
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
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
    let cancelled = false;
    (async () => {
      try {
        const me = await api("/api/me");
        if (!cancelled) {
          setUser(me);
          setToken(stored);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
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
    localStorage.setItem("sessionToken", body.token);
    setToken(body.token);
    setUser(body.user);
    setStatus("ready");
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
      requestChallenge,
      consumeToken,
      logout,
      logoutAll,
    }),
    [user, token, status, requestChallenge, consumeToken, logout, logoutAll]
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
