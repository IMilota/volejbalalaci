import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { applySkipped, expandRecurrence } from "./expandRecurrence";

const WEEKDAYS = [
  { value: "1", label: "Pondělí" },
  { value: "2", label: "Úterý" },
  { value: "3", label: "Středa" },
  { value: "4", label: "Čtvrtek" },
  { value: "5", label: "Pátek" },
  { value: "6", label: "Sobota" },
  { value: "7", label: "Neděle" },
];

const EXPAND_ERROR = {
  incomplete: "Vyplň den, časy a období.",
  range: "Datum od musí být před datem do.",
  times: "Konec musí být po začátku.",
  empty: "V tomto období žádný takový den není.",
  tooMany: "Najednou jde vytvořit nejvýš 40 termínů.",
};

function formError(err) {
  if (err instanceof ApiError) {
    return errorCopy(err.code, err.message);
  }
  return errorCopy("network");
}

function terminyLabel(count) {
  if (count === 1) {
    return "1 termín";
  }
  if (count >= 2 && count <= 4) {
    return `${count} termíny`;
  }
  return `${count} termínů`;
}

function vynechaneLabel(count) {
  if (count === 1) {
    return "1 vynechaný";
  }
  if (count >= 2 && count <= 4) {
    return `${count} vynechané`;
  }
  return `${count} vynechaných`;
}

function formatPreviewDate(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function BulkEventForm({ show, onHide, onCreated }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("12");
  const [description, setDescription] = useState("");
  const [weekday, setWeekday] = useState("3");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState([]);

  useEffect(() => {
    if (!show) {
      return;
    }
    setName("");
    setLocation("");
    setCapacity("12");
    setDescription("");
    setWeekday("3");
    setFrom("");
    setTo("");
    setStartTime("17:00");
    setEndTime("19:00");
    setError(null);
    setBusy(false);
    setSkipped([]);
  }, [show]);

  const plan = useMemo(
    () =>
      expandRecurrence({
        weekday,
        from,
        to,
        startTime,
        endTime,
      }),
    [weekday, from, to, startTime, endTime]
  );
  const kept = useMemo(
    () => applySkipped(plan.occurrences, skipped),
    [plan.occurrences, skipped]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setError("Kapacita musí být aspoň 1.");
      return;
    }
    if (plan.error) {
      setError(EXPAND_ERROR[plan.error] || EXPAND_ERROR.incomplete);
      return;
    }
    if (kept.length < 1) {
      setError("Vyber aspoň jeden termín.");
      return;
    }
    const payload = {
      name: name.trim(),
      location: location.trim(),
      capacity: cap,
      occurrences: kept.map(({ startAt, endAt }) => ({ startAt, endAt })),
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

  const previewReady = !plan.error && plan.occurrences.length > 0;
  const skippedCount = plan.occurrences.length - kept.length;

  function toggleSkip(date) {
    setSkipped((prev) => (prev.includes(date) ? prev.filter((item) => item !== date) : [...prev, date]));
  }

  return (
    <Modal
      show={show}
      onHide={busy ? undefined : onHide}
      scrollable
      dialogClassName="modal-vb-fit"
    >
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>Opakované termíny</Modal.Title>
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
          <Form.Group className="mb-3" controlId="bulk-weekday">
            <Form.Label>Den</Form.Label>
            <Form.Select value={weekday} onChange={(e) => setWeekday(e.target.value)} disabled={busy}>
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="bulk-pair mb-3">
            <Form.Group controlId="bulk-start-time">
              <Form.Label>Začátek</Form.Label>
              <Form.Control
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={busy}
              />
            </Form.Group>
            <Form.Group controlId="bulk-end-time">
              <Form.Label>Konec</Form.Label>
              <Form.Control
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={busy}
              />
            </Form.Group>
          </div>
          <div className="bulk-pair mb-3">
            <Form.Group controlId="bulk-from">
              <Form.Label>Od</Form.Label>
              <Form.Control
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={busy}
              />
            </Form.Group>
            <Form.Group controlId="bulk-to">
              <Form.Label>Do</Form.Label>
              <Form.Control
                type="date"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={busy}
              />
            </Form.Group>
          </div>
          {previewReady ? (
            <div className="bulk-preview">
              <strong>
                {terminyLabel(kept.length)}
                {skippedCount > 0 ? ` · ${vynechaneLabel(skippedCount)}` : ""}
              </strong>
              <ul className="bulk-preview-list">
                {plan.occurrences.map((row) => {
                  const omitted = skipped.includes(row.date);
                  const label = formatPreviewDate(row.date);
                  return (
                    <li
                      key={row.date}
                      className={omitted ? "bulk-preview-item is-skipped" : "bulk-preview-item"}
                    >
                      <span className="bulk-preview-date">{label}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={omitted ? "outline-primary" : "outline-danger"}
                        disabled={busy}
                        aria-label={omitted ? `Vrátit ${label}` : `Odebrat ${label}`}
                        onClick={() => toggleSkip(row.date)}
                      >
                        {omitted ? "Vrátit" : "Odebrat"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : from && to ? (
            <p className="text-muted mb-0">{EXPAND_ERROR[plan.error] || EXPAND_ERROR.incomplete}</p>
          ) : null}
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
