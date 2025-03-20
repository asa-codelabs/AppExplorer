import * as vscode from "vscode";
import { CardData } from "./EventTypes";
import { HandlerContext } from "./extension";
import { getRelativePath } from "./get-relative-path";
import { LocationFinder } from "./location-finder";

interface CardDecoration extends vscode.DecorationOptions {
  card: CardData;
}

export class EditorDecorator {
  #decorator: vscode.TextEditorDecorationType;
  #activeEdtior: vscode.TextEditor | undefined;
  timeout: NodeJS.Timeout | undefined;
  #decoratorMap = new WeakMap<vscode.TextEditor, CardDecoration[]>();
  subscriptions: vscode.Disposable[] = [];

  constructor(private handlerContext: HandlerContext) {
    this.#decorator = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("appExplorer.backgroundHighlight"),
      overviewRulerColor: new vscode.ThemeColor("appExplorer.rulerColor"),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
    this.#activeEdtior = vscode.window.activeTextEditor;

    let lastPosition: vscode.Position | undefined;
    let lastEditor: vscode.TextEditor | undefined;

    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(
        (editor) => {
          if (this.#activeEdtior && !editor) {
            lastPosition = this.#activeEdtior.selection.active;
            lastEditor = this.#activeEdtior;
            setTimeout(() => {
              lastPosition = undefined;
              lastEditor = undefined;
            }, 500);
          }

          this.#activeEdtior = editor;
          if (this.#activeEdtior) {
            this.triggerUpdate();
          }
        },
        null,
        this.subscriptions,
      ),
    );
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(
        (event) => {
          if (
            this.#activeEdtior &&
            event.document === this.#activeEdtior.document
          ) {
            this.triggerUpdate(true);
          }
        },
        null,
        this.subscriptions,
      ),
    );

    this.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection(
        async (event) => {
          const editor = event.textEditor;
          if (editor) {
            const position = editor.selection.active;
            if (lastEditor && editor !== lastEditor && lastPosition) {
              /* This implementation triggers when just switching tabs. I really
               * want to detect jumpToDefinition */
              // this.onJump(lastEditor, lastPosition, editor, position);
            }
            lastPosition = position;
          }
        },
        null,
        this.subscriptions,
      ),
    );

    if (this.#activeEdtior) {
      this.triggerUpdate();
    }
    const disposable = handlerContext.cardStorage.event(() =>
      this.triggerUpdate(true),
    );
    this.subscriptions.push(disposable);
  }

  dispose() {
    this.#decorator.dispose();
    this.subscriptions.forEach((s) => s.dispose());
  }

  async onJump(
    lastEditor: vscode.TextEditor,
    lastPosition: vscode.Position,
    editor: vscode.TextEditor,
    position: vscode.Position,
  ) {
    const fromRanges = this.#decoratorMap.get(lastEditor);
    const fromCard = fromRanges?.reduce(
      (prev: CardDecoration | null, value) => {
        if (lastPosition && value.range.contains(lastPosition)) {
          if (prev?.range.contains(value.range)) {
            return value;
          }
          return value;
        }
        return prev;
      },
      null,
    );

    if (fromCard) {
      const toRanges = this.#decoratorMap.get(editor);
      const toCard = toRanges?.reduce((prev: CardDecoration | null, value) => {
        if (position && value.range.contains(position)) {
          if (prev?.range.contains(value.range)) {
            return value;
          }
          return value;
        }
        return prev;
      }, null);
      if (!toCard && fromCard.card.miroLink) {
        await vscode.commands.executeCommand("app-explorer.createCard", {
          connect: [fromCard.card.miroLink!],
        });
      }
    }
  }

  triggerUpdate(throttle = false) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    if (throttle) {
      this.timeout = setTimeout(this.decorateEditor, 500);
    } else {
      this.decorateEditor();
    }
  }

  getCardsInEditor(editor: vscode.TextEditor) {
    const path = getRelativePath(editor.document.uri);
    return [...this.handlerContext.cardStorage.listAllCards()].filter(
      (card) => card.path === path,
    );
  }

  decorateEditor = async () => {
    const editor = this.#activeEdtior;
    if (!editor) {
      return;
    }
    const document = editor.document;
    const cards = this.getCardsInEditor(editor);
    const locationFinder = new LocationFinder();
    const symbols = await locationFinder.findSymbolsInDocument(document.uri);

    const ranges = cards.flatMap((card): CardDecoration[] => {
      if (card?.type === "symbol") {
        const symbol = symbols.find((symbol) => symbol.label === card.symbol);
        if (symbol?.range) {
          return [
            {
              range: symbol.range,
              hoverMessage: `AppExplorer: ${card.title}`,
              card,
            },
          ];
        }
      }
      return [];
    });

    this.#decoratorMap.set(editor, ranges);
    editor.setDecorations(this.#decorator, ranges);
  };
}
