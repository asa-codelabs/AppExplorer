# Agent Notes

These notes capture long-term instructions for working on this repository.

 - Always run `npm run lint` before committing changes. Do **not** run `npm test`
   because it requires VS Code binaries that cannot be fetched here; rely on
   manual testing instead.
- The project continues to use **WebSockets** for communication between the
  extension and `MiroServer`. The server runs inside the extension process and
  communicates using a token rather than direct object references.
- The server is bundled with the extension and started automatically on demand.
  The first workspace that needs it will attempt to launch the server; other
  workspaces connect to the existing instance. When a connection is lost each
  workspace waits a short random time before attempting to reconnect or start a
  new server.
- Take small incremental steps so that the extension is usable after each
  change.
- Record future instructions or decisions in this file to save time.

## Development Notes

- The plan document (`docs/remote-miro-server-plan.md`) now ends with a
  **Progress Checklist**. Update this checklist as tasks are completed and
  before starting new work.
