import { useContext, useState } from "react";
import { Outlet } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import Button from "react-bootstrap/Button";

import Form from "react-bootstrap/Form";

import Icon from "@mdi/react";
import { mdiLoading, mdiLogout, mdiLogin } from "@mdi/js";

import AppContext from "./app-provider";
import UserContext from "./user-provider";

import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const appContext = useContext(AppContext);
  const userContext = useContext(UserContext);
  const [userInputValue, setUserInputValue] = useState("");

  return (
    <div>
      {!["cashflow", "volejbalalaci"].includes(appContext.appCode) ? (
        <Navbar
          fixed="top"
          expand={"sm"}
          className="mb-3"
          variant="light"
          style={{ backgroundColor: appContext.bgColor || "lightblue" }}
        >
          <Container fluid>
            <Navbar.Brand>{appContext.app || "Celoškovi"}</Navbar.Brand>
            <Nav className="justify-content-end">
              {userContext.state !== "pending" &&
                !userContext.user.userName && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Form.Control
                      value={userInputValue}
                      style={{ maxWidth: "150px", height: "34px" }}
                      type="text"
                      placeholder="zadej přezdívku"
                      onChange={(e) => setUserInputValue(e.target.value)}
                    />
                    <Button
                      size={"sm"}
                      onClick={() => {
                        setUserInputValue("");
                        userContext.login(userInputValue);
                      }}
                      disabled={userInputValue?.length > 3 ? false : true}
                    >
                      <Icon size={1} path={mdiLogin} />
                    </Button>
                  </div>
                )}
              {userContext.state === "pending" && (
                <Icon size={1} path={mdiLoading} spin={true} />
              )}
              {userContext.state !== "pending" && userContext.user.userName && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {userContext.user.userType === "admin"
                    ? ""
                    : userContext.user.userName}
                  <Button
                    size={"sm"}
                    onClick={() =>
                      userContext.logout(userContext.user.userName)
                    }
                    variant="danger"
                  >
                    <Icon size={1} path={mdiLogout} />
                  </Button>
                </div>
              )}
            </Nav>
          </Container>
        </Navbar>
      ) : null}
      <Outlet />
    </div>
  );
}

export default App;
