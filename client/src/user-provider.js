import { createContext, useState } from "react";

const UserContext = createContext();

export function UserProvider({ children }) {
  const localUser = localStorage.getItem("localUser");
  const [user, setUser] = useState(
    localUser ? JSON.parse(localUser) : { userName: "", userType: "" }
  );
  const [authState, setAuthState] = useState("ready");

  async function login(userName) {
    setAuthState({
      state: "pending",
    });
    try {
      const res = await fetch(`/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userName }),
      });
      const body = await res.json();
      localStorage.setItem("localUser", JSON.stringify(body));
      setUser(body);
      setAuthState("ready");
    } catch (e) {
      console.log(e);
    }
  }

  async function logout(userName) {
    setAuthState({
      state: "pending",
    });
    try {
      const res = await fetch(`/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userName }),
      });
      const body = await res.json();
      localStorage.setItem("localUser", JSON.stringify(body));
      setUser(body);
      setAuthState("ready");
    } catch (e) {
      console.log(e);
    }
  }

  return (
    <UserContext.Provider value={{ user, authState, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export default UserContext;
