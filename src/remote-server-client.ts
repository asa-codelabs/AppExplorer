import { io, Socket } from "socket.io-client";
import * as vscode from "vscode";
import {
  ExtensionRequestEvents,
  ExtensionResponseEvents,
  MiroEvents,
  Queries,
} from "./EventTypes";
import type { MiroServerApi } from "./miro-server-api";

export class RemoteMiroServer
  extends vscode.EventEmitter<MiroEvents>
  implements MiroServerApi
{
  readonly socket: Socket<ExtensionResponseEvents, ExtensionRequestEvents>;

  constructor(private authToken: string) {
    super();
    this.socket = io("http://localhost:9042/client", {
      auth: { token: this.authToken },
      autoConnect: false,
      reconnection: false,
    }) as Socket<ExtensionResponseEvents, ExtensionRequestEvents>;
    this.socket.on("event", (e) => this.fire(e));
  }

  connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  waitForConnect(): Promise<void> {
    if (this.socket.connected) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        this.socket.off("connect", onConnect);
        this.socket.off("connect_error", onError);
      };
      this.socket.on("connect", onConnect);
      this.socket.on("connect_error", onError);
      this.connect();
    });
  }

  async query<
    Req extends keyof Queries,
    Res extends Awaited<ReturnType<Queries[Req]>>,
  >(boardId: string, name: Req, ...data: Parameters<Queries[Req]>): Promise<Res> {
    const requestId = Math.random().toString(36);
    return new Promise<Res>((resolve) => {
      this.socket.emit("query", { boardId, name, requestId, data });
      this.socket.on("queryResult", function onResult(this: Socket, response) {
        if (response.requestId === requestId) {
          this.off("queryResult", onResult);
          resolve(response.response as Res);
        }
      });
    });
  }

  dispose() {
    this.socket.disconnect();
    super.dispose();
  }
}
