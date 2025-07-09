# Remote MiroServer Planning

This document explains how the `MiroServer` communicates with the rest of the
extension using WebSockets. The server now uses a small API interface rather
than direct access to `HandlerContext`. Although the design allows running the
server in a separate process, we currently keep it bundled with the extension
and communicate using a shared token.

## 1. Separate concerns

1. **Define a formal API** between the extension and the server. Instead of
   passing the entire `HandlerContext`, create an interface for the methods that
   `MiroServer` needs (e.g. `connectBoard`, `setBoardName`, `setBoardCards`,
   etc.).
2. **Encapsulate `MiroServer` in its own module.** The implementation no longer
   needs direct access to VS Code APIs and communicates only through the defined
   interface.
3. **Implement an extension-side client** that speaks this API. All extension
   commands interact with the server by calling this client instead of
   instantiating `MiroServer` directly. This allows the server to move out of
   process later if desired, though it currently runs within the extension.

## 2. Communication approach

Communication uses **WebSockets** via `socket.io`. The server currently runs
inside the extension process, and all commands are routed over this WebSocket
API using a shared token. This structure would still allow moving the server to
a separate process later, but that is no longer a short-term goal.

All communication happens over `ws://localhost:9042`, which is considered
secure for local development even without TLS. Because the server always runs on
`localhost`, there is no need to support `wss`.

## 3. Suggested implementation steps

1. **Create a small interface** (e.g. `AppExplorerBackend`) that contains the
   methods `MiroServer` currently uses from `HandlerContext`.
2. **Refactor `MiroServer`** so that it depends only on this interface. Provide
   an implementation that forwards the calls over your chosen transport.
3. **Extract the server logic into a standalone module** without VS Code
   dependencies. The extension can load this module directly and expose it via
   WebSockets.
4. **Update the extension** to communicate with the server only through the
   WebSocket client. This keeps the server logic independent and ready for a
   future move out of process if we ever need it.
5. **Consider authentication** if the server can be reached over a network. A
   shared token stored in the extension's secret storage will be passed to the
   server on launch and included with each request.

## 4. Additional considerations

- **Synchronization**: Ensure that card and board data stay in sync when multiple
  clients interact with the remote server simultaneously.
- **Error handling**: Network failures should surface meaningful errors in the
  extension UI.
- **Versioning**: When the API evolves, include a version field in requests so
  old extensions can interoperate with newer servers.
- **Structured JSON schema**: Requests and responses use explicit JSON shapes
  rather than mirroring raw socket events. This makes remote communication
  easier to evolve.
- **Persistent storage**: The remote server keeps board information only in
  memory. Miro itself remains the source of truth, so no extra persistent layer
  is required.
- **Authentication**: The extension stores a token in VS Code's secret storage
  and sends it to the server at startup. The server verifies incoming requests
  using this token.
- **Shared server**: All VS Code workspaces will connect to a single server. Any
  workspace may launch it, but the port number is fixed because changing it at
  runtime would require updating the Miro integration for everyone.
- **Performance**: No issues have been observed with large boards when using
  WebSocket communication.

## 5. Short-term migration plan

The immediate goal is to decouple `MiroServer` from VS Code APIs. All
communication already flows over WebSockets using a shared token. The server
remains bundled with the extension and runs in-process. There are no plans to
extract it unless a future requirement appears.

## 6. Server packaging and startup

Miro is configured to always connect to `localhost:9042` and users cannot
change this. The extension bundles the server and starts it on demand. The first
workspace that needs a connection attempts to launch the server; other
workspaces connect to the existing instance. If a connection is lost, each
workspace uses an exponential backoff (starting at 0.5s and capped at 10s) with
random jitter before trying to reconnect. On failure it tries to start a new
server. The operating system's port lock ensures that only one instance can
bind to the port at a time.

---
This plan should make it easier to host the Miro integration on a remote
machine while keeping the VS Code extension lightweight.

## 7. Open Questions

- How can we ensure a stale server shuts down when no workspaces remain
  connected?

## Progress Checklist

- [x] Documented the remote server plan
- [x] Created `AppExplorerBackend` interface
- [x] Refactored `MiroServer` to use the new backend and broadcast events
- [x] Added `RemoteMiroServer` client with token authentication
- [x] Wired extension through the client while still launching the bundled server
- [x] Server remains bundled with the extension
- [x] Handle network errors and reconnection logic
- [ ] Add versioning to the WebSocket protocol
- [ ] Verify multi‑workspace communication works reliably
- [ ] Document final migration steps once remote server is stable
