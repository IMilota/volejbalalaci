import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import Icon from "@mdi/react";
import { mdiClose, mdiMinus, mdiOpenInNew, mdiPencil, mdiPlus } from "@mdi/js";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";
import AttendanceIcons from "../events/AttendanceIcons";
import EventForm from "../events/EventForm";
import { attendanceLevel } from "../events/attendanceLevel";
import { attendeeCaption, effectiveAttendanceStatus, listMembers } from "../events/attendeeList";
import MessageThread from "../messages/MessageThread";
import { useUsers } from "../users/UsersProvider";

function clampGuests(value) {
  return Math.min(6, Math.max(0, Number.parseInt(value, 10) || 0));
}

function formatRange(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateFmt = new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" });
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
  const [guests, setGuests] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);

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

  const myAttendance = useMemo(
    () => attendances.find((row) => row.userId === user?.id),
    [attendances, user?.id]
  );
  const members = useMemo(
    () => listMembers({ users, attendances, myUserId: user?.id, displayName }),
    [users, attendances, user?.id, displayName]
  );

  useEffect(() => {
    setGuests(myAttendance?.guests || 0);
  }, [myAttendance]);

  const currentStatus = effectiveAttendanceStatus(myAttendance?.status);
  const cancelledEvent = event?.status === "cancelled";
  const rsvpDisabled = cancelledEvent || rsvpBusy || !event;

  async function submitRsvp(userId, status, nextGuests) {
    if (rsvpDisabled) {
      return;
    }
    const isMe = userId === user.id;
    const existing = attendances.find((row) => row.userId === userId);
    const current = effectiveAttendanceStatus(existing?.status);
    const guestsChanged = isMe && status === "yes" && nextGuests !== undefined;
    if (status === current && !guestsChanged) {
      return;
    }
    setRsvpError(null);
    setRsvpBusy(true);
    const body = isMe
      ? { status, guests: status === "yes" ? clampGuests(nextGuests ?? guests) : 0 }
      : { status };
    const path = isMe
      ? `/api/events/${id}/attendances/me`
      : `/api/events/${id}/attendances/${userId}`;
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

  async function confirmCancel() {
    setCancelBusy(true);
    setRsvpError(null);
    try {
      const saved = await api(`/api/events/${id}/cancel`, { method: "POST" });
      setEvent(saved);
      setCancelOpen(false);
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

  return (
    <Container className="event-detail">
      <div className="event-detail-top">
        <header className="event-header">
        <div className="event-header-top">
          <h1 className="event-header-title">
            {event.name}
            {cancelledEvent ? <Badge bg="danger">Zrušeno</Badge> : null}
          </h1>
          {isAdmin ? (
            <div className="event-header-tools">
              <Button
                variant="outline-primary"
                size="sm"
                aria-label="Upravit"
                title="Upravit"
                onClick={() => setEditOpen(true)}
                disabled={cancelBusy}
              >
                <Icon path={mdiPencil} size={0.85} />
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                aria-label="Zrušit"
                title="Zrušit"
                onClick={() => setCancelOpen(true)}
                disabled={cancelBusy || cancelledEvent}
              >
                {cancelBusy ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <Icon path={mdiClose} size={0.85} />
                )}
              </Button>
            </div>
          ) : null}
        </div>
        <dl className="event-header-meta">
          <div>
            <dt>Kdy</dt>
            <dd>{formatRange(event.startAt, event.endAt)}</dd>
          </div>
          <div>
            <dt>Kde</dt>
            <dd>{event.location}</dd>
          </div>
        </dl>
        {event.description ? <p className="event-header-desc">{event.description}</p> : null}
      </header>

      {rsvpError ? <Alert variant="danger">{rsvpError}</Alert> : null}

      <div className="event-attendees-head">
        <h2 className="h5 event-attendees-title">Účastníci</h2>
        <button
          type="button"
          className={`event-attendance event-attendance--${attendanceLevel(event.occupied)}`}
          aria-label={`Otevřít účastníky, ${event.occupied} / ${event.capacity}`}
          title="Do 5 je málo, 6–8 se dá hrát, 9 a víc je super"
          onClick={() => setOthersOpen(true)}
        >
          {event.occupied} / {event.capacity}
          <Icon path={mdiOpenInNew} size={0.7} />
        </button>
      </div>
      <ul className="event-attendees list-unstyled">
        <li className="event-attendee event-attendee--me">
          <div className="event-attendee-main">
            <strong className="event-attendee-name">{displayName(user.id)}</strong>
            <AttendanceIcons
              status={currentStatus}
              disabled={rsvpDisabled}
              onSelect={(status) => submitRsvp(user.id, status)}
            />
          </div>
          {currentStatus === "yes" ? (
            <div className="event-guests" role="group" aria-labelledby="rsvp-guests-label">
              <span className="event-guests-label" id="rsvp-guests-label">
                Hosté
              </span>
              <button
                type="button"
                className="event-rsvp-btn"
                aria-label="Méně hostů"
                disabled={rsvpDisabled || guests <= 0}
                onClick={() => {
                  const nextGuests = clampGuests(guests - 1);
                  setGuests(nextGuests);
                  submitRsvp(user.id, "yes", nextGuests);
                }}
              >
                <Icon path={mdiMinus} size={0.9} />
              </button>
              <span className="event-guests-count">{guests}</span>
              <button
                type="button"
                className="event-rsvp-btn"
                aria-label="Více hostů"
                disabled={rsvpDisabled || guests >= 6}
                onClick={() => {
                  const nextGuests = clampGuests(guests + 1);
                  setGuests(nextGuests);
                  submitRsvp(user.id, "yes", nextGuests);
                }}
              >
                <Icon path={mdiPlus} size={0.9} />
              </button>
            </div>
          ) : null}
        </li>
      </ul>

      <h2 className="h5 event-messages-title">Zprávy</h2>
      </div>
      <MessageThread eventId={id} />

      <EventForm show={editOpen} onHide={() => setEditOpen(false)} event={event} onSaved={setEvent} />
      <Modal
        show={othersOpen}
        onHide={() => setOthersOpen(false)}
        animation={false}
        scrollable
        dialogClassName="modal-vb-fit"
        aria-labelledby="attendees-modal-title"
      >
        <Modal.Header closeButton>
          <div className="event-attendees-head event-attendees-head--modal">
            <Modal.Title as="h2" id="attendees-modal-title">
              Účastníci
            </Modal.Title>
            <span
              className={`event-attendance event-attendance--${attendanceLevel(event.occupied)}`}
              title="Do 5 je málo, 6–8 se dá hrát, 9 a víc je super"
            >
              {event.occupied} / {event.capacity}
            </span>
          </div>
        </Modal.Header>
        <Modal.Body>
          {members.length === 0 ? (
            <p className="mb-0 text-muted">Nikdo další zatím není.</p>
          ) : (
            <ul className="event-attendees event-others-list list-unstyled mb-0">
              {members.map((row) => {
                const name = displayName(row.userId);
                const isMe = row.userId === user.id;
                return (
                  <li key={row.userId} className="event-attendee">
                    <strong className="event-attendee-name">
                      {attendeeCaption(name, row.status, row.guests)}
                    </strong>
                    <div className="event-attendee-controls">
                      <AttendanceIcons
                        status={row.status}
                        name={name}
                        disabled={rsvpDisabled}
                        onSelect={
                          isAdmin || isMe ? (status) => submitRsvp(row.userId, status) : undefined
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal.Body>
      </Modal>
      <Modal
        show={cancelOpen}
        onHide={cancelBusy ? undefined : () => setCancelOpen(false)}
        scrollable
        dialogClassName="modal-vb-fit"
      >
        <Modal.Header closeButton={!cancelBusy}>
          <Modal.Title>Zrušit tento termín?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {rsvpError ? <Alert variant="danger">{rsvpError}</Alert> : null}
          Termín „{event.name}“ se zruší. Účastníci ho uvidí jako zrušený, zprávy zůstanou.
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setCancelOpen(false)}
            disabled={cancelBusy}
          >
            Ponechat
          </Button>
          <Button variant="danger" onClick={confirmCancel} disabled={cancelBusy}>
            {cancelBusy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
            Zrušit termín
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
