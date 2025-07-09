import type { Socket } from "socket.io";
import type { BoardInfo } from "./card-storage";
import type { CardData } from "./EventTypes";
import type { HandlerContext } from "./extension";

export interface AppExplorerBackend {
  connectBoard(boardId: string, socket: Socket): Promise<void>;
  getBoard(boardId: string): BoardInfo | undefined;
  addBoard(boardId: string, name: string): Promise<BoardInfo>;
  setBoardName(boardId: string, name: string): BoardInfo | undefined;
  setBoardCards(boardId: string, cards: CardData[]): void;
  getBoardSocket(boardId: string): Socket | undefined;
}

export function createBackend(context: HandlerContext): AppExplorerBackend {
  return {
    async connectBoard(boardId, socket) {
      await context.cardStorage.connectBoard(boardId, socket);
    },
    getBoard: (id) => context.cardStorage.getBoard(id),
    addBoard: (id, name) => context.cardStorage.addBoard(id, name),
    setBoardName: (id, name) => context.cardStorage.setBoardName(id, name),
    setBoardCards: (id, cards) => context.cardStorage.setBoardCards(id, cards),
    getBoardSocket: (id) => context.cardStorage.getBoardSocket(id),
  };
}
