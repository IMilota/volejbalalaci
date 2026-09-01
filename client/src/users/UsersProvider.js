import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

const UsersContext = createContext(null);

function labelFor(user, id) {
  if (user?.name) {
    return user.name;
  }
  if (user?.nickname) {
    return user.nickname;
  }
  return String(id || "").slice(0, 8);
}

export function UsersProvider({ children }) {
  const { status } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (status !== "ready") {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/api/users");
        if (!cancelled) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setUsers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const displayName = useCallback(
    (id) => {
      const user = users.find((item) => item.id === id);
      return labelFor(user, id);
    },
    [users]
  );

  const value = useMemo(() => ({ users, displayName }), [users, displayName]);

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) {
    throw new Error("useUsers must be used within UsersProvider");
  }
  return ctx;
}
