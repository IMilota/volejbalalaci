import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { attendeeLabel } from "./label";

const UsersContext = createContext(null);

async function fetchUsers() {
  const data = await api("/api/users");
  return Array.isArray(data) ? data : [];
}

export function UsersProvider({ children }) {
  const { status } = useAuth();
  const [users, setUsers] = useState([]);

  const reload = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    if (status !== "ready") {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchUsers();
        if (!cancelled) {
          setUsers(data);
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
      return attendeeLabel(user, id);
    },
    [users]
  );

  const value = useMemo(() => ({ users, displayName, reload }), [users, displayName, reload]);

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) {
    throw new Error("useUsers must be used within UsersProvider");
  }
  return ctx;
}
