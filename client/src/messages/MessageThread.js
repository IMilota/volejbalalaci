import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import Icon from "@mdi/react";
import { mdiDotsVertical, mdiSend } from "@mdi/js";
import { ApiError, api } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";
import { useUsers } from "../users/UsersProvider";
import { toChatItems } from "./groupMessages";

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

function threadRootId(message) {
  return message.replyToId || message.id;
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
  const [editingId, setEditingId] = useState(null);
  const logRef = useRef(null);

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

  async function handleSubmit(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await api(`/api/messages/${editingId}`, { method: "PATCH", body: { body } });
        setEditingId(null);
      } else {
        const extra = replyToId ? { replyToId } : {};
        await api("/api/messages", { method: "POST", body: postPayload(body, extra) });
        setReplyToId(null);
      }
      setDraft("");
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

  const items = toChatItems(messages);
  const replyTarget = messages.find((item) => item.id === replyToId) || null;
  const editingTarget = messages.find((item) => item.id === editingId) || null;

  useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  function cancelCompose() {
    if (editingId) {
      setDraft("");
    }
    setReplyToId(null);
    setEditingId(null);
  }

  return (
    <div className="chat-thread">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <div className="chat-log" ref={logRef}>
        {loading ? (
          <div className="d-flex justify-content-center py-4">
            <Spinner animation="border" />
          </div>
        ) : (
          items.map(({ message, parent }) => {
            const mine = user?.id === authorIdOf(message);
            const managing = canManage(message);
            return (
              <article
                key={message.id}
                className={`chat-msg${mine ? " chat-msg--mine" : ""}`}
              >
                {parent ? (
                  <div className="chat-msg-quote">
                    <span className="chat-msg-quote-author">{displayName(authorIdOf(parent))}</span>
                    {parent.body}
                  </div>
                ) : null}
                <div className="chat-msg-top">
                  <div className="chat-msg-meta">
                    <strong>{displayName(authorIdOf(message))}</strong>
                    <span className="chat-msg-time">{formatStamp(message.createdAt)}</span>
                  </div>
                  <Dropdown align="end" className="chat-msg-menu">
                    <Dropdown.Toggle
                      variant="link"
                      className="chat-msg-menu-btn"
                      aria-label="Akce ke zprávě"
                      disabled={busy}
                    >
                      <Icon path={mdiDotsVertical} size={0.85} />
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item
                        as="button"
                        onClick={() => {
                          setReplyToId(threadRootId(message));
                          setEditingId(null);
                        }}
                      >
                        Odpovědět
                      </Dropdown.Item>
                      {managing ? (
                        <>
                          <Dropdown.Item
                            as="button"
                            onClick={() => {
                              setEditingId(message.id);
                              setDraft(message.body);
                              setReplyToId(null);
                            }}
                          >
                            Upravit
                          </Dropdown.Item>
                          <Dropdown.Item
                            as="button"
                            className="text-danger"
                            onClick={() => handleDelete(message)}
                          >
                            Smazat
                          </Dropdown.Item>
                        </>
                      ) : null}
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
                <p className="chat-msg-body mb-0">{message.body}</p>
              </article>
            );
          })
        )}
      </div>
      <Form onSubmit={handleSubmit} className="chat-compose">
        {editingTarget ? (
          <div className="chat-compose-reply">
            <div className="chat-msg-quote mb-0">
              <span className="chat-msg-quote-author">Úprava</span>
            </div>
            <Button
              type="button"
              variant="link"
              className="chat-compose-reply-close"
              aria-label="Zrušit úpravu"
              disabled={busy}
              onClick={cancelCompose}
            >
              ×
            </Button>
          </div>
        ) : replyTarget ? (
          <div className="chat-compose-reply">
            <div className="chat-msg-quote mb-0">
              <span className="chat-msg-quote-author">{displayName(authorIdOf(replyTarget))}</span>
              {replyTarget.body}
            </div>
            <Button
              type="button"
              variant="link"
              className="chat-compose-reply-close"
              aria-label="Zrušit odpověď"
              disabled={busy}
              onClick={cancelCompose}
            >
              ×
            </Button>
          </div>
        ) : null}
        <div className="chat-compose-row">
          <Form.Group className="mb-0 flex-grow-1" controlId={`message-body-${eventId || "board"}`}>
            <Form.Label visuallyHidden>Zpráva</Form.Label>
            <Form.Control
              type="text"
              maxLength={2000}
              value={draft}
              disabled={busy}
              autoComplete="off"
              placeholder={editingTarget ? "Upravit zprávu" : "Napsat zprávu"}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Form.Group>
          <Button
            type="submit"
            className="chat-compose-send"
            aria-label="Odeslat"
            title="Odeslat"
            disabled={busy || !draft.trim()}
          >
            {busy ? <Spinner animation="border" size="sm" /> : <Icon path={mdiSend} size={0.85} />}
          </Button>
        </div>
      </Form>
    </div>
  );
}
