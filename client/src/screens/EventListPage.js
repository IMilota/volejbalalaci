import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Spinner from "react-bootstrap/Spinner";
import Icon from "@mdi/react";
import { mdiCalendarPlus, mdiPlus } from "@mdi/js";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";
import AttendanceIcons from "../events/AttendanceIcons";
import { attendanceLevel } from "../events/attendanceLevel";
import BulkEventForm from "../events/BulkEventForm";
import EventForm from "../events/EventForm";

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

export default function EventListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rsvpError, setRsvpError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/api/events");
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(loadMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitRsvp(event, status) {
    if (event.status === "cancelled" || busyId) {
      return;
    }
    if (status === event.myStatus) {
      return;
    }
    setBusyId(event.id);
    setRsvpError(null);
    try {
      const saved = await api(`/api/events/${event.id}/attendances/me`, {
        method: "PUT",
        body: { status, guests: 0 },
      });
      const fresh = await api(`/api/events/${event.id}`);
      setEvents((prev) =>
        prev.map((row) =>
          row.id === event.id
            ? { ...fresh, myStatus: fresh.myStatus ?? saved.status ?? status }
            : row
        )
      );
    } catch (err) {
      setRsvpError(loadMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Container className="pb-4">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
        <h1 className="h3 mb-0">Termíny</h1>
        {isAdmin ? (
          <div className="event-header-tools">
            <Button
              variant="outline-primary"
              size="sm"
              aria-label="Nová událost"
              title="Nová událost"
              onClick={() => setCreateOpen(true)}
            >
              <Icon path={mdiPlus} size={0.85} />
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              aria-label="Nové události"
              title="Nové události"
              onClick={() => setBulkOpen(true)}
            >
              <Icon path={mdiCalendarPlus} size={0.85} />
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {rsvpError ? <Alert variant="danger">{rsvpError}</Alert> : null}
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        events.map((event) => {
          const cancelled = event.status === "cancelled";
          return (
            <Card key={event.id} className="mb-3">
              <Card.Body className="pb-2">
                <Link to={`/events/${event.id}`} className="text-decoration-none text-reset">
                  <div className="event-card-top">
                    <Card.Title as="h2" className="event-card-title mb-0">
                      {event.name}
                      {cancelled ? <Badge bg="danger">Zrušeno</Badge> : null}
                    </Card.Title>
                    <span
                      className={`event-attendance event-attendance--${attendanceLevel(event.occupied)}`}
                      title="Do 5 je málo, 6–8 se dá hrát, 9 a víc je super"
                    >
                      {event.occupied} / {event.capacity}
                    </span>
                  </div>
                  <Card.Text className="event-card-when mb-0">
                    {formatRange(event.startAt, event.endAt)}
                  </Card.Text>
                </Link>
                <div className="event-card-rsvp">
                  <AttendanceIcons
                    status={event.myStatus}
                    legend="Moje účast"
                    disabled={cancelled || busyId === event.id}
                    onSelect={(status) => submitRsvp(event, status)}
                  />
                </div>
              </Card.Body>
            </Card>
          );
        })
      )}
      <EventForm show={createOpen} onHide={() => setCreateOpen(false)} />
      <BulkEventForm
        show={bulkOpen}
        onHide={() => setBulkOpen(false)}
        onCreated={load}
      />
    </Container>
  );
}
