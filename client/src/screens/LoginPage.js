import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { ApiError } from "../api/client";
import { errorCopy } from "../api/error-copy";
import { useAuth } from "../auth/AuthProvider";

const CHALLENGE_SUCCESS = "Když účet existuje, přišel ti e-mail s odkazem.";

function loginErrorMessage(err) {
  if (err instanceof ApiError) {
    return errorCopy(err.code, err.message);
  }
  return errorCopy("network");
}

export default function LoginPage() {
  const { consumeToken, requestChallenge } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const magicToken = searchParams.get("token");
  const consumeStarted = useRef(false);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [consuming, setConsuming] = useState(Boolean(magicToken));

  useEffect(() => {
    if (!magicToken || consumeStarted.current) {
      return undefined;
    }
    consumeStarted.current = true;
    setConsuming(true);
    setError(null);
    (async () => {
      try {
        await consumeToken(magicToken);
        navigate("/", { replace: true });
      } catch (err) {
        setError(loginErrorMessage(err));
        setConsuming(false);
      }
    })();
    return undefined;
  }, [magicToken, consumeToken, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSent(false);
    setBusy(true);
    try {
      await requestChallenge(email.trim());
      setSent(true);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 480 }}>
      <h1 className="h3 mb-3">Přihlášení</h1>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {sent ? <Alert variant="primary">{CHALLENGE_SUCCESS}</Alert> : null}
      {consuming ? (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Ověřuji odkaz…</span>
        </div>
      ) : (
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="login-email">
            <Form.Label>E-mail</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={busy}
            />
          </Form.Group>
          <Button type="submit" className="btn-primary" disabled={busy}>
            {busy ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Odesílám
              </>
            ) : (
              "Poslat odkaz"
            )}
          </Button>
        </Form>
      )}
    </div>
  );
}
