import { useCallback, useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";
import { useUsers } from "../users/UsersProvider";
import { groupMessages } from "./groupMessages";

function loadMessage(err) {
  if (err instanceof ApiError) {
    return errorCopy(err.code, err.message);
  }
  return errorCopy("network");
}

function authorIdOf(message) {
  return message.userId || message.authorId;
}

function messagesPath(eventId) {
  return eventId ? `/api/messages?eventId=${eventId}` : "/api/messages";
}

function formatStamp(iso) {
  if (!iso) {
    return "";
  }
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function MessageThread({ eventId }) {
  const { user } = useAuth();
  const { displayName } = useUsers();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyToId, setReplyToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  const load = useCallback(async ({ silent } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await api(messagesPath(eventId));
      setMessages(Array.isArray(data) ? data : []);
      if (silent) {
        setError(null);
      }
    } catch (err) {
      setError(loadMessage(err));
      if (!silent) {
        setMessages([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  function canManage(message) {
    return user?.id === authorIdOf(message) || user?.role === "admin";
  }

  function postPayload(body, extra = {}) {
    const payload = { body, ...extra };
    if (eventId) {
      payload.eventId = eventId;
    }
    return payload;
  }

  async function handlePost(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/messages", { method: "POST", body: postPayload(body) });
      setDraft("");
      await load({ silent: true });
    } catch (err) {
      setError(loadMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReply(event) {
    event.preventDefault();
    const body = replyDraft.trim();
    if (!body || !replyToId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/messages", {
        method: "POST",
        body: postPayload(body, { replyToId }),
      });
      setReplyDraft("");
      setReplyToId(null);
      await load({ silent: true });
    } catch (err) {
      setError(loadMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePatch(event) {
    event.preventDefault();
    const body = editDraft.trim();
    if (!body || !editingId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/messages/${editingId}`, { method: "PATCH", body: { body } });
      setEditingId(null);
      setEditDraft("");
      await load({ silent: true });
    } catch (err) {
      setError(loadMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(message) {
    if (!window.confirm("Smazat tuto zprávu?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/messages/${message.id}`, { method: "DELETE" });
      await load({ silent: true });
    } catch (err) {
      setError(loadMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const { roots, repliesByParent } = groupMessages(messages);

  function renderMessage(message, isReply) {
    const editing = editingId === message.id;
    const managing = canManage(message);

    return (
      <div key={message.id} className={isReply ? "ps-4 border-start mb-2" : "mb-2"}>
        <div className="d-flex justify-content-between gap-2 flex-wrap">
          <strong>{displayName(authorIdOf(message))}</strong>
          <span className="text-muted small">{formatStamp(message.createdAt)}</span>
        </div>
        {editing ? (
          <Form onSubmit={handlePatch} className="mt-2">
            <Form.Control
              as="textarea"
              rows={2}
              maxLength={2000}
              value={editDraft}
              disabled={busy}
              onChange={(e) => setEditDraft(e.target.value)}
            />
            <div className="d-flex gap-2 mt-2">
              <Button type="submit" size="sm" disabled={busy || !editDraft.trim()}>
                {busy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                Uložit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline-secondary"
                disabled={busy}
                onClick={() => {
                  setEditingId(null);
                  setEditDraft("");
                }}
              >
                Zavřít
              </Button>
            </div>
          </Form>
        ) : (
          <p className="mb-1">{message.body}</p>
        )}
        {!editing ? (
          <div className="d-flex gap-2 flex-wrap">
            {!isReply ? (
              <Button
                size="sm"
                variant="outline-primary"
                disabled={busy}
                onClick={() => {
                  setReplyToId(message.id);
                  setReplyDraft("");
                }}
              >
                Odpovědět
              </Button>
            ) : null}
            {managing ? (
              <>
                <Button
                  size="sm"
                  variant="outline-primary"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(message.id);
                    setEditDraft(message.body);
                  }}
                >
                  Upravit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => handleDelete(message)}
                >
                  Smazat
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
        {!isReply && replyToId === message.id ? (
          <Form onSubmit={handleReply} className="mt-2 ps-4">
            <Form.Control
              as="textarea"
              rows={2}
              maxLength={2000}
              value={replyDraft}
              disabled={busy}
              placeholder="Odpověď"
              onChange={(e) => setReplyDraft(e.target.value)}
            />
            <div className="d-flex gap-2 mt-2">
              <Button type="submit" size="sm" disabled={busy || !replyDraft.trim()}>
                {busy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                Odeslat
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline-secondary"
                disabled={busy}
                onClick={() => {
                  setReplyToId(null);
                  setReplyDraft("");
                }}
              >
                Zavřít
              </Button>
            </div>
          </Form>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="d-flex justify-content-center py-4">
          <Spinner animation="border" />
        </div>
      ) : (
        roots.map((root) => (
          <div key={root.id} className="border-bottom pb-2 mb-3">
            {renderMessage(root, false)}
            {(repliesByParent[root.id] || []).map((reply) => renderMessage(reply, true))}
          </div>
        ))
      )}
      <Form onSubmit={handlePost}>
        <Form.Group className="mb-2" controlId={`message-body-${eventId || "board"}`}>
          <Form.Label>Nová zpráva</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            maxLength={2000}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Form.Group>
        <Button type="submit" disabled={busy || !draft.trim()}>
          {busy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
          Odeslat
        </Button>
      </Form>
    </div>
  );
}
