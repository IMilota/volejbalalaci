import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { UsersProvider } from "../users/UsersProvider";
import MessageThread from "./MessageThread";

jest.mock("../api/client", () => ({
  api: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor({ code, message, status }) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

jest.mock("../auth/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

afterEach(() => {
  api.mockReset();
});

const users = [
  { id: "u1", name: "Ivo", nickname: "ivo" },
  { id: "u2", name: "Alena", nickname: "alena" },
];

const root = {
  id: "m1",
  body: "první zpráva",
  userId: "u2",
  replyToId: null,
  createdAt: "2026-09-02T14:00:00.000Z",
};

const mine = {
  id: "m2",
  body: "moje zpráva",
  userId: "u1",
  replyToId: null,
  createdAt: "2026-09-02T14:01:00.000Z",
};

const reply = {
  id: "m3",
  body: "odpověď na první",
  userId: "u1",
  replyToId: "m1",
  createdAt: "2026-09-02T14:02:00.000Z",
};

function mockUser(role = "user") {
  useAuth.mockReturnValue({
    user: { id: "u1", name: "Ivo", nickname: "ivo", role },
    token: "sess",
    status: "ready",
  });
}

function renderThread(messages = [root, mine, reply]) {
  api.mockImplementation((path, opts = {}) => {
    if (path === "/api/users") {
      return Promise.resolve(users);
    }
    if (path.startsWith("/api/messages") && !opts.method) {
      return Promise.resolve(messages);
    }
    return Promise.resolve({});
  });
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <UsersProvider>
        <MessageThread eventId="e1" />
      </UsersProvider>
    </MemoryRouter>
  );
}

test("renders a chat stream without visible action buttons", async () => {
  mockUser();
  renderThread();
  await waitFor(() => expect(screen.getAllByText("první zpráva").length).toBeGreaterThan(0));
  expect(screen.queryAllByRole("button", { name: /odpovědět/i })).toHaveLength(0);
  expect(screen.queryAllByRole("button", { name: /upravit/i })).toHaveLength(0);
  expect(screen.queryAllByRole("button", { name: /^smazat$/i })).toHaveLength(0);
  expect(screen.queryByText("Nová zpráva")).not.toBeInTheDocument();
  const composer = screen.getByRole("textbox", { name: /zpráva/i });
  expect(composer).toBeInTheDocument();
  expect(composer.tagName).toBe("INPUT");
});

test("own messages are highlighted and replies quote the parent", async () => {
  mockUser();
  renderThread();
  await waitFor(() => expect(screen.getByText("moje zpráva")).toBeInTheDocument());
  expect(screen.getByText("moje zpráva").closest(".chat-msg")).toHaveClass("chat-msg--mine");
  expect(screen.queryAllByText("já")).toHaveLength(0);
  expect(screen.getAllByText("první zpráva")[0].closest(".chat-msg")).not.toHaveClass("chat-msg--mine");
  const replyBubble = screen.getByText("odpověď na první").closest(".chat-msg");
  expect(replyBubble).toHaveClass("chat-msg--mine");
  expect(replyBubble.firstElementChild).toHaveClass("chat-msg-quote");
  expect(within(replyBubble).getByText("první zpráva")).toBeInTheDocument();
  expect(replyBubble).not.toHaveClass("ps-4");
});

test("composer stays after the scrollable log", async () => {
  mockUser();
  renderThread();
  await waitFor(() => expect(screen.getByText("moje zpráva")).toBeInTheDocument());
  const thread = document.querySelector(".chat-thread");
  const log = thread.querySelector(".chat-log");
  const compose = thread.querySelector(".chat-compose");
  expect(log).not.toBeNull();
  expect(compose).not.toBeNull();
  expect(log.compareDocumentPosition(compose) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("edit uses the composer instead of growing the bubble", async () => {
  mockUser();
  renderThread([mine]);
  await waitFor(() => expect(screen.getByText("moje zpráva")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /akce ke zprávě/i }));
  fireEvent.click(await screen.findByRole("button", { name: /upravit/i }));
  const composer = screen.getByRole("textbox", { name: /zpráva/i });
  expect(composer).toHaveValue("moje zpráva");
  expect(document.querySelector(".chat-msg textarea")).toBeNull();
  expect(screen.getByText(/úprava/i)).toBeInTheDocument();
});

test("message menu offers reply, and edit/delete for own messages", async () => {
  mockUser();
  renderThread([mine]);
  await waitFor(() => expect(screen.getByText("moje zpráva")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /akce ke zprávě/i }));
  expect(await screen.findByRole("button", { name: /odpovědět/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /upravit/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^smazat$/i })).toBeInTheDocument();
});
