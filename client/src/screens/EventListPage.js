import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Spinner from "react-bootstrap/Spinner";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";
import BulkEventForm from "../events/BulkEventForm";
import EventForm from "../events/EventForm";

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

export default function EventListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/api/events");
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? errorCopy(err.code, err.message) : errorCopy("network"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Container className="pb-4">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
        <h1 className="h3 mb-0">Termíny</h1>
        {isAdmin ? (
          <div className="d-flex gap-2">
            <Button onClick={() => setCreateOpen(true)}>Nová událost</Button>
            <Button variant="outline-primary" onClick={() => setBulkOpen(true)}>
              Nové události
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        events.map((event) => (
          <Card
            key={event.id}
            as={Link}
            to={`/events/${event.id}`}
            className="text-decoration-none text-reset mb-3"
          >
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start gap-2">
                <Card.Title className="mb-1">{event.name}</Card.Title>
                {event.status === "cancelled" ? (
                  <Badge bg="danger">Zrušeno</Badge>
                ) : null}
              </div>
              <Card.Text className="mb-1">{formatRange(event.startAt, event.endAt)}</Card.Text>
              <Card.Text className="mb-1">{event.location}</Card.Text>
              <Card.Text className="mb-0">
                {event.occupied} / {event.capacity}
              </Card.Text>
            </Card.Body>
          </Card>
        ))
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
