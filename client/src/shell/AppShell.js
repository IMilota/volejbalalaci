import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import Offcanvas from "react-bootstrap/Offcanvas";
import Icon from "@mdi/react";
import { mdiBell, mdiBellOff, mdiDownload, mdiLogout, mdiLogoutVariant, mdiVolleyball } from "@mdi/js";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { useInstallPrompt } from "../pwa/useInstallPrompt";
import { usePushSubscription } from "../pwa/usePushSubscription";

export default function AppShell() {
  const { user, logout, logoutAll } = useAuth();
  const { config } = useConfig();
  const { canInstall, install } = useInstallPrompt();
  const { canEnable, canDisable, enable, disable } = usePushSubscription();
  const brand = config.instanceName || "Volejbalaláci";
  const [navExpanded, setNavExpanded] = useState(false);

  function closeNav() {
    setNavExpanded(false);
  }

  return (
    <div className="app-shell">
      <Navbar
        expand="sm"
        variant="dark"
        className="navbar-vb"
        fixed="top"
        collapseOnSelect
        expanded={navExpanded}
        onToggle={setNavExpanded}
      >
        <Container fluid>
          <Navbar.Brand
            as={Link}
            to="/"
            title="Nejbližší událost"
            className="d-flex align-items-center gap-2"
            onClick={closeNav}
          >
            <Icon path={mdiVolleyball} size={1} />
            {brand}
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="app-nav" />
          <Navbar.Offcanvas
            id="app-nav"
            aria-labelledby="app-nav-label"
            placement="end"
            className="navbar-vb text-white"
          >
            <Offcanvas.Header closeButton closeVariant="white">
              <Offcanvas.Title
                id="app-nav-label"
                as={Link}
                to="/"
                className="text-white"
                onClick={closeNav}
              >
                {brand}
              </Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="d-flex flex-column flex-sm-row">
              <Nav className="me-auto">
                <Nav.Link as={Link} to="/" eventKey="home">
                  Nejbližší událost
                </Nav.Link>
                <Nav.Link as={Link} to="/events" eventKey="events">
                  Termíny
                </Nav.Link>
                {user?.role === "admin" ? (
                  <Nav.Link as={Link} to="/users" eventKey="users">
                    Členové
                  </Nav.Link>
                ) : null}
              </Nav>
              <Nav className="align-items-stretch align-items-sm-center gap-2 mt-3 mt-sm-0">
                <Navbar.Text className="text-white">
                  {user?.name || user?.nickname}
                </Navbar.Text>
                {canInstall ? (
                  <Button size="sm" variant="outline-light" onClick={() => install()}>
                    <Icon path={mdiDownload} size={0.8} className="me-1" />
                    Nainstalovat
                  </Button>
                ) : null}
                {canEnable ? (
                  <Button size="sm" variant="outline-light" onClick={() => enable()}>
                    <Icon path={mdiBell} size={0.8} className="me-1" />
                    Zapnout oznámení
                  </Button>
                ) : null}
                {canDisable ? (
                  <Button size="sm" variant="outline-light" onClick={() => disable()}>
                    <Icon path={mdiBellOff} size={0.8} className="me-1" />
                    Vypnout oznámení
                  </Button>
                ) : null}
                <Button size="sm" variant="outline-light" onClick={() => logout()}>
                  <Icon path={mdiLogout} size={0.8} className="me-1" />
                  Odhlásit
                </Button>
                <Button size="sm" variant="danger" onClick={() => logoutAll()}>
                  <Icon path={mdiLogoutVariant} size={0.8} className="me-1" />
                  Odhlásit všude
                </Button>
              </Nav>
            </Offcanvas.Body>
          </Navbar.Offcanvas>
        </Container>
      </Navbar>
      <Outlet />
    </div>
  );
}
