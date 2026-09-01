import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Spinner from "react-bootstrap/Spinner";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";
import BulkEventForm from "../events/BulkEventForm";
import EventForm from "../events/EventForm";
import { pickNearestScheduled } from "../events/pickNearestScheduled";

export default function HomePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nearestId, setNearestId] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const events = await api("/api/events");
        if (cancelled) {
          return;
        }
        const nearest = pickNearestScheduled(events);
        if (nearest) {
          setNearestId(nearest.id);
          setEmpty(false);
        } else {
          setNearestId(null);
          setEmpty(true);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof ApiError ? errorCopy(err.code, err.message) : errorCopy("network"));
        setEmpty(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (nearestId) {
    return <Navigate to={`/events/${nearestId}`} replace />;
  }

  return (
    <Container className="pb-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {empty ? <p className="mb-3">Zatím žádný termín.</p> : null}
      {isAdmin ? (
        <div className="d-flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>Nová událost</Button>
          <Button variant="outline-primary" onClick={() => setBulkOpen(true)}>
            Nové události
          </Button>
        </div>
      ) : null}
      <EventForm show={createOpen} onHide={() => setCreateOpen(false)} />
      <BulkEventForm show={bulkOpen} onHide={() => setBulkOpen(false)} />
    </Container>
  );
}
