import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";
import EventForm from "../events/EventForm";
import MessageThread from "../messages/MessageThread";
import { useUsers } from "../users/UsersProvider";

const STATUS_LABEL = {
  yes: "Ano",
  no: "Ne",
  maybe: "Možná",
};

function formatRange(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateFmt = new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const timeFmt = new Intl.DateTimeFormat("cs-CZ", { timeStyle: "short" });
  return `${dateFmt.format(start)} – ${timeFmt.format(end)}`;
}

function loadMessage(err) {
  if (err instanceof ApiError) {
    return errorCopy(err.code, err.message);
  }
  return errorCopy("network");
}

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { users, displayName } = useUsers();
  const isAdmin = user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [event, setEvent] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [rsvpError, setRsvpError] = useState(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [note, setNote] = useState("");
  const [guests, setGuests] = useState(0);
  const [targetUserId, setTargetUserId] = useState(user?.id);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    setTargetUserId(user?.id);
  }, [user?.id, id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRsvpError(null);
    (async () => {
      try {
        const [ev, atts] = await Promise.all([
          api(`/api/events/${id}`),
          api(`/api/events/${id}/attendances`),
        ]);
        if (cancelled) {
          return;
        }
        setEvent(ev);
        setAttendances(Array.isArray(atts) ? atts : []);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setLoadError(loadMessage(err));
        setEvent(null);
        setAttendances([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const editingAttendance = useMemo(
    () => attendances.find((row) => row.userId === targetUserId),
    [attendances, targetUserId]
  );

  useEffect(() => {
    setNote(editingAttendance?.note || "");
    setGuests(editingAttendance?.guests || 0);
  }, [editingAttendance]);

  const currentStatus = editingAttendance?.status;
  const cancelledEvent = event?.status === "cancelled";
  const rsvpDisabled = cancelledEvent || rsvpBusy || !event;

  async function submitRsvp(status) {
    if (rsvpDisabled) {
      return;
    }
    setRsvpError(null);
    setRsvpBusy(true);
    const body = {
      status,
      guests: status === "yes" ? Math.min(6, Math.max(0, Number.parseInt(guests, 10) || 0)) : 0,
      note,
    };
    const path =
      targetUserId && targetUserId !== user.id
        ? `/api/events/${id}/attendances/${targetUserId}`
        : `/api/events/${id}/attendances/me`;
    try {
      const saved = await api(path, { method: "PUT", body });
      setAttendances((prev) => {
        const rest = prev.filter((row) => row.userId !== saved.userId);
        return [...rest, saved];
      });
      const fresh = await api(`/api/events/${id}`);
      setEvent(fresh);
    } catch (err) {
      setRsvpError(loadMessage(err));
    } finally {
      setRsvpBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Zrušit tento termín?")) {
      return;
    }
    setCancelBusy(true);
    setRsvpError(null);
    try {
      const saved = await api(`/api/events/${id}/cancel`, { method: "POST" });
      setEvent(saved);
    } catch (err) {
      setRsvpError(loadMessage(err));
    } finally {
      setCancelBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Container className="pb-4">
        <Alert variant="danger">{loadError}</Alert>
      </Container>
    );
  }

  if (!event) {
    return null;
  }

  const showGuests = currentStatus === "yes";

  return (
    <Container className="pb-4">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
        <div>
          <h1 className="h3 mb-1">
            {event.name}{" "}
            {cancelledEvent ? (
              <Badge bg="danger" className="align-middle">
                Zrušeno
              </Badge>
            ) : null}
          </h1>
          <p className="mb-1">{formatRange(event.startAt, event.endAt)}</p>
          <p className="mb-1">{event.location}</p>
          <p className="mb-0">
            {event.occupied} / {event.capacity}
          </p>
          {event.description ? <p className="mt-2 mb-0">{event.description}</p> : null}
        </div>
        {isAdmin ? (
          <div className="d-flex gap-2">
            <Button variant="outline-primary" onClick={() => setEditOpen(true)} disabled={cancelBusy}>
              Upravit
            </Button>
            <Button variant="danger" onClick={handleCancel} disabled={cancelBusy || cancelledEvent}>
              {cancelBusy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
              Zrušit
            </Button>
          </div>
        ) : null}
      </div>

      {rsvpError ? <Alert variant="danger">{rsvpError}</Alert> : null}

      <h2 className="h5">Moje účast</h2>
      {isAdmin ? (
        <Form.Group className="mb-3" controlId="rsvp-user">
          <Form.Label>Za člena</Form.Label>
          <Form.Select
            value={targetUserId || user.id}
            disabled={rsvpDisabled}
            onChange={(e) => setTargetUserId(e.target.value)}
          >
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {displayName(item.id)}
                {item.id === user.id ? " (já)" : ""}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      ) : null}
      <ButtonGroup className="mb-3">
        <Button
          variant="primary"
          disabled={rsvpDisabled}
          aria-pressed={currentStatus === "yes"}
          onClick={() => submitRsvp("yes")}
        >
          {rsvpBusy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
          Ano
        </Button>
        <Button
          variant="outline-danger"
          className="btn-rsvp-no"
          disabled={rsvpDisabled}
          aria-pressed={currentStatus === "no"}
          onClick={() => submitRsvp("no")}
        >
          Ne
        </Button>
        <Button
          variant="light"
          disabled={rsvpDisabled}
          aria-pressed={currentStatus === "maybe"}
          onClick={() => submitRsvp("maybe")}
        >
          Možná
        </Button>
      </ButtonGroup>
      {showGuests ? (
        <Form.Group className="mb-3" controlId="rsvp-guests" style={{ maxWidth: 160 }}>
          <Form.Label>Hosté</Form.Label>
          <Form.Control
            type="number"
            min={0}
            max={6}
            value={guests}
            disabled={rsvpDisabled}
            onChange={(e) => setGuests(e.target.value)}
          />
        </Form.Group>
      ) : null}
      <Form.Group className="mb-3" controlId="rsvp-note">
        <Form.Label>Poznámka</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          maxLength={280}
          value={note}
          disabled={rsvpDisabled}
          onChange={(e) => setNote(e.target.value)}
        />
      </Form.Group>
      {currentStatus ? (
        <Button
          className="mb-4"
          variant="outline-primary"
          disabled={rsvpDisabled}
          onClick={() => submitRsvp(currentStatus)}
        >
          Uložit
        </Button>
      ) : null}

      <h2 className="h5">Účastníci</h2>
      <ul className="list-unstyled">
        {attendances.map((row) => (
          <li key={row.id || row.userId} className="border-bottom py-2">
            <strong>{displayName(row.userId)}</strong> {STATUS_LABEL[row.status] || row.status}
            {row.status === "yes" && row.guests > 0 ? ` · hosté ${row.guests}` : ""}
            {row.note ? ` · ${row.note}` : ""}
          </li>
        ))}
      </ul>

      <h2 className="h5 mt-4">Zprávy</h2>
      <MessageThread eventId={id} />

      <EventForm show={editOpen} onHide={() => setEditOpen(false)} event={event} onSaved={setEvent} />
    </Container>
  );
}
