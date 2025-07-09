import * as vscode from "vscode";
import type { HandlerContext } from "../extension";
import type { MiroServerApi } from "../miro-server-api";

export function makeRenameHandler(
  context: HandlerContext,
  miroServer: MiroServerApi,
) {
  return async function renameHandler(boardId?: string) {
    await context.waitForConnections();
    const connectedBoardIds = context.cardStorage.getConnectedBoards();
    const boards = connectedBoardIds.map(
      (k) => context.cardStorage.getBoard(k)!,
    );
    if (!boardId) {
      const items = boards.map((board): vscode.QuickPickItem => {
        return {
          label: board.name ?? board.id,
          detail: `${Object.keys(board.cards).length} cards`,
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        title: "Which board would you like to rename?",
      });
      if (!selected) {
        return;
      }
      const index = items.indexOf(selected);
      return renameHandler(connectedBoardIds[index]);
    }
    const board = boards.find((b) => b.id === boardId);

    const newName = await vscode.window.showInputBox({
      value: board?.name ?? boardId,
      prompt: "Enter new name",
    });

    if (!newName) {
      return;
    }
    await miroServer.query(boardId, "setBoardName", newName);
    context.cardStorage.setBoardName(boardId, newName);
  };
}
