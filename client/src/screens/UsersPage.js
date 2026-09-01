import { useCallback, useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";
import { useUsers } from "../users/UsersProvider";

const EMPTY_FIELDS = {
  name: "",
  nickname: "",
  email: "",
  role: "user",
};

function formError(err) {
  if (err instanceof ApiError) {
    return errorCopy(err.code, err.message);
  }
  return errorCopy("network");
}

function loadError(err) {
  if (err instanceof ApiError) {
    return errorCopy(err.code, err.message);
  }
  return errorCopy("network");
}

function roleLabel(role) {
  return role === "admin" ? "správce" : "člen";
}

function MemberForm({ show, member, lastAdminLocked, onHide, onSaved }) {
  const editing = Boolean(member?.id);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!show) {
      return;
    }
    setError(null);
    setBusy(false);
    if (member) {
      setFields({
        name: member.name || "",
        nickname: member.nickname || "",
        email: member.email || "",
        role: member.role || "user",
      });
    } else {
      setFields(EMPTY_FIELDS);
    }
  }, [show, member]);

  function update(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: fields.name.trim(),
      nickname: fields.nickname.trim(),
      email: fields.email.trim(),
      role: fields.role,
    };
    setBusy(true);
    try {
      const saved = editing
        ? await api(`/api/users/${member.id}`, { method: "PATCH", body: payload })
        : await api("/api/users", { method: "POST", body: payload });
      onHide();
      onSaved(saved);
    } catch (err) {
      setError(formError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} onHide={busy ? undefined : onHide}>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>{editing ? "Upravit člena" : "Nový člen"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Form.Group className="mb-3" controlId="member-name">
            <Form.Label>Jméno</Form.Label>
            <Form.Control
              required
              value={fields.name}
              onChange={(e) => update("name", e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="member-nickname">
            <Form.Label>Přezdívka</Form.Label>
            <Form.Control
              required
              value={fields.nickname}
              onChange={(e) => update("nickname", e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="member-email">
            <Form.Label>E-mail</Form.Label>
            <Form.Control
              type="email"
              required
              value={fields.email}
              onChange={(e) => update("email", e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-0" controlId="member-role">
            <Form.Label>Role</Form.Label>
            <Form.Select
              value={fields.role}
              onChange={(e) => update("role", e.target.value)}
              disabled={busy || lastAdminLocked}
            >
              <option value="user">člen</option>
              <option value="admin">správce</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>
            Zavřít
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
            {editing ? "Uložit" : "Vytvořit"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const { reload } = useUsers();
  const isAdmin = user?.role === "admin";
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/api/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(loadError(err));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      return undefined;
    }
    load();
    return undefined;
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <Container className="pb-4">
        <Alert variant="danger">Nemáš oprávnění.</Alert>
      </Container>
    );
  }

  const adminCount = users.filter((item) => item.role === "admin").length;
  const lastAdminLocked = Boolean(
    editing && editing.role === "admin" && adminCount === 1
  );

  return (
    <Container className="pb-4">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
        <h1 className="h3 mb-0">Členové</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Nový člen
        </Button>
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </div>
      ) : error ? null : (
        <Table responsive hover>
          <thead>
            <tr>
              <th>Jméno</th>
              <th>Přezdívka</th>
              <th>E-mail</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.nickname}</td>
                <td>{member.email}</td>
                <td>{roleLabel(member.role)}</td>
                <td className="text-end">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => {
                      setEditing(member);
                      setFormOpen(true);
                    }}
                  >
                    Upravit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <MemberForm
        show={formOpen}
        member={editing}
        lastAdminLocked={lastAdminLocked}
        onHide={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          load();
          reload();
        }}
      />
    </Container>
  );
}
