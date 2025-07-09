/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServer } from "http";
import * as path from "path";
import type { Socket, Namespace } from "socket.io";
import { Server } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import invariant from "tiny-invariant";
import * as vscode from "vscode";
import {
  CardData,
  Queries,
  RequestEvents,
  ResponseEvents,
  MiroEvents,
  ExtensionRequestEvents,
  ExtensionResponseEvents,
} from "./EventTypes";
import type { AppExplorerBackend } from "./backend";
import type { MiroServerApi } from "./miro-server-api";
import compression = require("compression");
import express = require("express");
import morgan = require("morgan");

// TODO: decouple MiroServer from VS Code via a WebSocket-based backend.
// The server stays in-process for now; see
// docs/remote-miro-server-plan.md for the migration steps.

export class MiroServer
  extends vscode.EventEmitter<MiroEvents>
  implements MiroServerApi
{
  subscriptions = [] as vscode.Disposable[];
  httpServer: ReturnType<typeof createServer>;
  extensionNamespace: Namespace<ExtensionRequestEvents, ExtensionResponseEvents>;
  extensionSockets = new Set<
    Socket<ExtensionRequestEvents, ExtensionResponseEvents>
  >();

  // `authToken` will be used once the server runs out-of-process to verify
  // requests from the extension.
  constructor(private backend: AppExplorerBackend, private authToken: string) {
    super();

    const app = express();
    this.httpServer = createServer(app);
    const io = new Server<ResponseEvents, RequestEvents>(this.httpServer);
    io.on("connection", this.onConnection.bind(this));
    this.extensionNamespace = io.of("/client");
    this.extensionNamespace.use((socket, next) => {
      if (socket.handshake.auth?.token !== this.authToken) {
        next(new Error("unauthorized"));
      } else {
        next();
      }
    });
    this.extensionNamespace.on("connection", (socket) => {
      this.extensionSockets.add(socket);
      socket.on("disconnect", () => {
        this.extensionSockets.delete(socket);
      });
      socket.on("query", async ({ boardId, name, requestId, data }) => {
        try {
          const result = await this.query(
            boardId,
            name as keyof Queries,
            ...((data as unknown) as Parameters<Queries[keyof Queries]>)
          );
          socket.emit("queryResult", { requestId, response: result });
        } catch (error) {
          socket.emit("queryResult", { requestId, response: null });
        }
      });
    });

    app.use(compression());
    app.use(
      "/",
      express.static(path.join(__dirname, "../public"), {
        index: "index.html",
      }),
    );

    app.use(morgan("tiny"));

    const port = 9042;

    this.httpServer.on("error", (e) => {
      vscode.window.showErrorMessage(`AppExplorer - ${String(e)}`);
    });
    this.httpServer.listen(port, () => {
      vscode.window.showInformationMessage(
        `AppExplorer - Server started. Open a Miro board to connect.`,
      );
    });
  }

  private broadcast(event: MiroEvents) {
    for (const socket of this.extensionSockets) {
      socket.emit("event", event);
    }
  }

  destroy() {
    this.subscriptions.forEach((s) => s.dispose());
    this.httpServer.closeAllConnections();
  }

  async onConnection(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket: Socket<ResponseEvents, RequestEvents, DefaultEventsMap, any>,
  ) {
    const { backend } = this;
    const info = await querySocket(socket, "getBoardInfo");
    const boardId = info.boardId;
    await backend.connectBoard(boardId, socket);
    socket.once("disconnect", () => {
      const event: MiroEvents = { type: "disconnect" };
      this.broadcast(event);
      this.fire(event);
    });
    socket.on("navigateTo", async (card) => {
      const event: MiroEvents = { type: "navigateToCard", card };
      this.broadcast(event);
      this.fire(event);
    });
    socket.on("card", async ({ url, card }) => {
      const event: MiroEvents = { type: "updateCard", miroLink: url, card };
      this.broadcast(event);
      this.fire(event);
    });

    let boardInfo = backend.getBoard(boardId);
    if (!boardInfo) {
      boardInfo = await backend.addBoard(boardId, info.name);
    } else if (boardInfo.name !== info.name) {
      backend.setBoardName(boardId, info.name);
      boardInfo = { ...boardInfo, name: info.name };
    }
    const cards = await querySocket(socket, "cards");
    backend.setBoardCards(boardId, cards);
    const event: MiroEvents = { type: "connect", boardInfo };
    this.broadcast(event);
    this.fire(event);
  }
  async query<Req extends keyof Queries, Res extends ReturnType<Queries[Req]>>(
    boardId: string,
    name: Req,
    ...data: Parameters<Queries[Req]>
  ): Promise<Res> {
    const socket = this.backend.getBoardSocket(boardId);
    invariant(socket, `No connection to board ${boardId}`);
    return querySocket<Req, Res>(socket, name, ...data);
  }
}

async function querySocket<
  Req extends keyof Queries,
  Res extends ReturnType<Queries[Req]>,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket: Socket<ResponseEvents, RequestEvents, DefaultEventsMap, any>,
  name: Req,
  ...data: Parameters<Queries[Req]>
): Promise<Res> {
  const requestId = Math.random().toString(36);
  return new Promise<Res>((resolve) => {
    socket.emit("query", {
      name,
      requestId,
      data,
    });
    socket.once("queryResult", (response) => {
      resolve(response.response as any);
    });
  });
}
