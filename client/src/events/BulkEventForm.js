import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";

function formError(err) {
  if (err instanceof ApiError) {
    return errorCopy(err.code, err.message);
  }
  return errorCopy("network");
}

function emptyOccurrence() {
  return { startAt: "", endAt: "" };
}

export default function BulkEventForm({ show, onHide, onCreated }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("12");
  const [description, setDescription] = useState("");
  const [occurrences, setOccurrences] = useState([emptyOccurrence()]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!show) {
      return;
    }
    setName("");
    setLocation("");
    setCapacity("12");
    setDescription("");
    setOccurrences([emptyOccurrence()]);
    setError(null);
    setBusy(false);
  }, [show]);

  function updateOccurrence(index, key, value) {
    setOccurrences((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setError("Kapacita musí být aspoň 1.");
      return;
    }
    if (occurrences.length < 1) {
      setError("Přidej aspoň jeden termín.");
      return;
    }
    const mapped = [];
    for (const row of occurrences) {
      if (!row.startAt || !row.endAt) {
        setError("Každý termín potřebuje začátek i konec.");
        return;
      }
      const startAt = new Date(row.startAt).toISOString();
      const endAt = new Date(row.endAt).toISOString();
      if (new Date(endAt) <= new Date(startAt)) {
        setError("Konec musí být po začátku.");
        return;
      }
      mapped.push({ startAt, endAt });
    }
    const payload = {
      name: name.trim(),
      location: location.trim(),
      capacity: cap,
      occurrences: mapped,
    };
    if (description.trim()) {
      payload.description = description.trim();
    }
    setBusy(true);
    try {
      await api("/api/events/bulk", { method: "POST", body: payload });
      onHide();
      if (onCreated) {
        await onCreated();
      }
      navigate("/events");
    } catch (err) {
      setError(formError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} size="lg">
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>Nové události</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Form.Group className="mb-3" controlId="bulk-name">
            <Form.Label>Název</Form.Label>
            <Form.Control required value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </Form.Group>
          <Form.Group className="mb-3" controlId="bulk-location">
            <Form.Label>Místo</Form.Label>
            <Form.Control
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="bulk-capacity">
            <Form.Label>Kapacita</Form.Label>
            <Form.Control
              type="number"
              min={1}
              step={1}
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="bulk-description">
            <Form.Label>Popis</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </Form.Group>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Termíny</strong>
            <Button
              type="button"
              size="sm"
              variant="outline-primary"
              disabled={busy}
              onClick={() => setOccurrences((prev) => [...prev, emptyOccurrence()])}
            >
              Přidat termín
            </Button>
          </div>
          {occurrences.map((row, index) => (
            <div key={index} className="border rounded p-3 mb-2">
              <Form.Group className="mb-2" controlId={`bulk-start-${index}`}>
                <Form.Label>Začátek</Form.Label>
                <Form.Control
                  type="datetime-local"
                  required
                  value={row.startAt}
                  onChange={(e) => updateOccurrence(index, "startAt", e.target.value)}
                  disabled={busy}
                />
              </Form.Group>
              <Form.Group className="mb-2" controlId={`bulk-end-${index}`}>
                <Form.Label>Konec</Form.Label>
                <Form.Control
                  type="datetime-local"
                  required
                  value={row.endAt}
                  onChange={(e) => updateOccurrence(index, "endAt", e.target.value)}
                  disabled={busy}
                />
              </Form.Group>
              {occurrences.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline-danger"
                  disabled={busy}
                  onClick={() => setOccurrences((prev) => prev.filter((_, i) => i !== index))}
                >
                  Odebrat
                </Button>
              ) : null}
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>
            Zavřít
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
            Vytvořit
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
