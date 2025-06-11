import { useEffect, useContext } from "react";

import AppContext from "../app-provider";

import EventList from "./EventList";
import NavBar from "./NavBar";
import UserProvider from "./UserProvider";
import EventListProvider from "./EventListProvider";

function Volejbalalaci() {
  const appContext = useContext(AppContext);

  /* eslint-disable */
  useEffect(() => {
    const element = document.getElementById("favicon");
    element.setAttribute("href", "/volejbalalaci.ico");
    const elementTitle = document.getElementById("title");
    elementTitle.replaceChildren("Volejbalaláci");
    appContext.setApp("Volejbalaláci");
    appContext.setAppCode("volejbalalaci");
    appContext.setBgColor("#E3B9FF");
  }, []);
  /* eslint-enable */

  return (
    <div style={componentStyle()}>
      <UserProvider>
        <EventListProvider>
          <div className="card-header">
            <NavBar />
          </div>
          <div style={bodyStyle()}>
            <EventList />
          </div>
          <div className={"card-footer text-light"} style={footerStyle()}>
            © Ivo Milota
          </div>
        </EventListProvider>
      </UserProvider>
    </div>
  );
}

function componentStyle() {
  return {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: "#187bcd",
  };
}

function bodyStyle() {
  return {
    overflow: "auto",
    padding: "16px",
    flex: "1",
    borderTop: "white 4px solid",
    borderBottom: "white 4px solid",
  };
}

function footerStyle() {
  return { padding: "8px", textAlign: "center", backgroundColor: "#d63232" };
}

export default Volejbalalaci;
