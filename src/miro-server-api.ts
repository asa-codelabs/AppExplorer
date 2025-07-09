import * as vscode from "vscode";
import type { MiroEvents, Queries } from "./EventTypes";

export interface MiroServerApi extends vscode.Disposable {
  readonly event: vscode.Event<MiroEvents>;
  query<
    Req extends keyof Queries,
    Res extends Awaited<ReturnType<Queries[Req]>>,
  >(boardId: string, name: Req, ...data: Parameters<Queries[Req]>): Promise<Res>;
}
