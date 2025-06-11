import { useEffect, useContext } from "react";
import "./App.css";
import AppContext from "./app-provider";

function Celoskovi() {
  const appContext = useContext(AppContext);

  /* eslint-disable */
  useEffect(() => {
    const element = document.getElementById("favicon");
    element.setAttribute("href", "/c.ico");
    const elementTitle = document.getElementById("title");
    elementTitle.replaceChildren("Celoškovi");
    appContext.setApp(undefined);
    appContext.setAppCode(undefined);
    appContext.setBgColor(undefined);
  }, []);
  /* eslint-enable */

  return <div className={"myContainer"}>celoškovi</div>;
}

export default Celoskovi;
