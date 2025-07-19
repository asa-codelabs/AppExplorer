import * as vscode from "vscode";
import type { HandlerContext } from "../extension";
import { getGitHubUrl } from "../get-github-url";

export const makeNavigationHandler = (context: HandlerContext) => {
  return async (miroLink: string, locationLink: vscode.LocationLink) => {
    const card = context.cardStorage.getCardByLink(miroLink);
    if (card && context.cardStorage.getConnectedBoards().length > 0) {
      const codeLink = await getGitHubUrl(locationLink);

      // Use universal query method through WorkspaceCardStorageProxy
      await context.cardStorage.query(card.boardId, "cardStatus", {
        codeLink,
        miroLink,
        status: "connected",
      });

      const success = await context.cardStorage.query(
        card.boardId,
        "selectCard",
        miroLink,
      );

      if (success) {
        await vscode.window.showInformationMessage(
          `Selected card ${card.title} [${miroLink}]`,
        );
      } else {
        await vscode.window.showErrorMessage(
          `Failed to select card ${card.title} [${miroLink}]`,
        );
      }
    } else {
      vscode.window.showInformationMessage(
        `Opening card ${miroLink} in browser`,
      );
      // Open the URL in the browser
      vscode.env.openExternal(vscode.Uri.parse(miroLink));
    }
  };
};
