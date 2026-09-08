import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";

function pad(value) {
  return String(value).padStart(2, "0");
}

export function toDatetimeLocal(iso) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value) {
  if (!value) {
    return undefined;
  }
  return new Date(value).toISOString();
}

function formError(err) {
  if (err instanceof ApiError) {
    return errorCopy(err.code, err.message);
  }
  return errorCopy("network");
}

const EMPTY = {
  name: "",
  startAt: "",
  endAt: "",
  location: "",
  capacity: "12",
  description: "",
};

export default function EventForm({ show, onHide, event, onSaved }) {
  const navigate = useNavigate();
  const editing = Boolean(event?.id);
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!show) {
      return;
    }
    setError(null);
    setBusy(false);
    if (event) {
      setFields({
        name: event.name || "",
        startAt: toDatetimeLocal(event.startAt),
        endAt: toDatetimeLocal(event.endAt),
        location: event.location || "",
        capacity: String(event.capacity ?? ""),
        description: event.description || "",
      });
    } else {
      setFields(EMPTY);
    }
  }, [show, event]);

  function update(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const startAt = fromDatetimeLocal(fields.startAt);
    const endAt = fromDatetimeLocal(fields.endAt);
    if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
      setError("Konec musí být po začátku.");
      return;
    }
    const capacity = Number(fields.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError("Kapacita musí být aspoň 1.");
      return;
    }
    const payload = {
      name: fields.name.trim(),
      startAt,
      endAt,
      location: fields.location.trim(),
      capacity,
    };
    const description = fields.description.trim();
    if (editing || description) {
      payload.description = description;
    }
    setBusy(true);
    try {
      const saved = editing
        ? await api(`/api/events/${event.id}`, { method: "PATCH", body: payload })
        : await api("/api/events", { method: "POST", body: payload });
      onHide();
      if (onSaved) {
        onSaved(saved);
      } else {
        navigate(`/events/${saved.id}`);
      }
    } catch (err) {
      setError(formError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      show={show}
      onHide={busy ? undefined : onHide}
      scrollable
      dialogClassName="modal-vb-fit"
    >
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>{editing ? "Upravit událost" : "Nová událost"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Form.Group className="mb-3" controlId="event-name">
            <Form.Label>Název</Form.Label>
            <Form.Control
              required
              value={fields.name}
              onChange={(e) => update("name", e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="event-start">
            <Form.Label>Začátek</Form.Label>
            <Form.Control
              type="datetime-local"
              required
              value={fields.startAt}
              onChange={(e) => update("startAt", e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="event-end">
            <Form.Label>Konec</Form.Label>
            <Form.Control
              type="datetime-local"
              required
              value={fields.endAt}
              onChange={(e) => update("endAt", e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="event-location">
            <Form.Label>Místo</Form.Label>
            <Form.Control
              required
              value={fields.location}
              onChange={(e) => update("location", e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="event-capacity">
            <Form.Label>Kapacita</Form.Label>
            <Form.Control
              type="number"
              min={1}
              step={1}
              required
              value={fields.capacity}
              onChange={(e) => update("capacity", e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-0" controlId="event-description">
            <Form.Label>Popis</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={fields.description}
              onChange={(e) => update("description", e.target.value)}
              disabled={busy}
            />
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
