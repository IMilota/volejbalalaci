import { Link, Outlet } from "react-router-dom";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import Icon from "@mdi/react";
import { mdiLogout, mdiLogoutVariant, mdiVolleyball } from "@mdi/js";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";

export default function AppShell() {
  const { user, logout, logoutAll } = useAuth();
  const { config } = useConfig();
  const brand = config.instanceName || "Volejbalaláci";

  return (
    <div>
      <Navbar expand="sm" variant="dark" className="navbar-vb mb-3">
        <Container fluid>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
            <Icon path={mdiVolleyball} size={1} />
            {brand}
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="app-nav" />
          <Navbar.Collapse id="app-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/board">
                Nástěnka
              </Nav.Link>
              <Nav.Link as={Link} to="/events">
                Termíny
              </Nav.Link>
              {user?.role === "admin" ? (
                <Nav.Link as={Link} to="/users">
                  Členové
                </Nav.Link>
              ) : null}
            </Nav>
            <Nav className="align-items-center gap-2">
              <Navbar.Text className="text-white">
                {user?.name || user?.nickname}
              </Navbar.Text>
              <Button
                size="sm"
                variant="outline-light"
                onClick={() => logout()}
              >
                <Icon path={mdiLogout} size={0.8} className="me-1" />
                Odhlásit
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => logoutAll()}
              >
                <Icon path={mdiLogoutVariant} size={0.8} className="me-1" />
                Odhlásit všude
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Outlet />
    </div>
  );
}
