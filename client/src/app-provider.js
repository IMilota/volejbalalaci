import { createContext, useState } from "react";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [app, setApp] = useState();
  const [appCode, setAppCode] = useState();
  const [bgColor, setBgColor] = useState();

  return (
    <AppContext.Provider
      value={{ app, setApp, appCode, setAppCode, bgColor, setBgColor }}
    >
      {children}
    </AppContext.Provider>
  );
}

export default AppContext;
