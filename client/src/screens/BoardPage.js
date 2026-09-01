import Container from "react-bootstrap/Container";
import MessageThread from "../messages/MessageThread";

export default function BoardPage() {
  return (
    <Container className="pb-4">
      <h1 className="h3 mb-3">Nástěnka</h1>
      <MessageThread eventId={null} />
    </Container>
  );
}
