/* global miro */

import { Task } from "@lit/task";
import { Tag } from "@mirohq/websdk-types";
import "@webcomponents/webcomponentsjs";
import classNames from "classnames";
import { css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import invariant from "tiny-invariant";
import { CardData } from "../EventTypes";
import { createDebug } from "../utils/create-debug";
import "./app-card";
import { AppElement } from "./app-element";
import "./cards-around-cursor";
import { CardsAroundCursorController } from "./cards-around-cursor-controller";
import { mirotoneStyles, rawMirotoneStyles } from "./mirotone";
import "./onboarding";
import "./server-status";
import { SocketProvider } from "./socket-context";
import "./tags-control";
// Mirotone must be loaded on the host page to set all the CSS variables.
document.head.insertAdjacentHTML(
  "beforeend",
  `<style>${rawMirotoneStyles}</style>`,
);

const debug = createDebug("app-explorer:miro:edit-card");

@customElement("app-explorer-edit-card")
export class EditCardElement extends AppElement {
  static styles = [
    mirotoneStyles,
    css`
      app-explorer-edit-card {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: start;
        width: 30rem;
        height: 100%;
        padding: 0 1rem;
      }

      app-explorer-edit-card .form-group {
        /* Allow smooth changes for sizing tweaks we apply */
        transition:
          flex-grow 0.3s ease-in-out,
          max-height 0.3s ease-in-out,
          margin 0.3s ease-in-out,
          padding 0.3s ease-in-out;
      }
      /*
       * (A) Layout foundation
       * We turn the <form> into a flex column container so that the
       * description row can grow to consume remaining vertical space when
       * expanded. This avoids using position:absolute (which caused the snap
       * / jump) and instead lets the browser interpolate flex-grow + heights.
       */
      form {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
      }

      /*
       * (B) Description group base state
       * Start with no flex-grow so it behaves like a normal row.
       * We also constrain its max-height to something close to the initial
       * textarea height so we can animate max-height -> large value.
       */
      .description-group {
        display: flex;
        flex-direction: column;
        flex-grow: 0;
        max-height: 9rem; /* ~ label + small textarea */
        /* Ensure internal elements stretch when expanded */
      }

      .description-group > label + * {
        /* The textarea right after label should grow inside the group */
        flex-grow: 1;
      }

      /*
       * (C) Expanded state
       * When the form has the .description-expanded class we:
       *  - Give the description group flex-grow:1 so it takes remaining space
       *  - Increase its max-height to a very large value so the transition
       *    animates the vertical growth (max-height is animatable, height:auto is not)
       *  - Collapse (visually) the other groups so the description can appear
       *    to take over the form. We fade + shrink them to maintain spatial context.
       */
      form.description-expanded .description-group {
        flex-grow: 1;
        max-height: 200vh; /* Large enough to fill container; animates smoothly */
        margin-top: 16px;
      }

      /* Make the textarea fill the available vertical space when expanded */
      form.description-expanded .description-group textarea {
        height: 100%;
        resize: none; /* Prevent manual resize from fighting layout */
      }

      /*
       * (D) Non-description groups in expanded mode:
       * We fade them out and collapse their vertical footprint so the
       * description appears dominant without an abrupt absolute positioning jump.
       * Using max-height + margin collapse for a smooth transition.
       */
      form.description-expanded .form-group:not(.description-group),
      form.description-expanded .flex-row:not(.description-group) {
        max-height: 0 !important;
        margin: 0;
        padding-top: 0;
        padding-bottom: 0;
        overflow: hidden;
        pointer-events: none;
      }

      /* Keep the action row (buttons) also hidden while expanded */
      form.description-expanded .flex-row.space-between {
        max-height: 0;
        margin: 0;
        overflow: hidden;
        pointer-events: none;
      }

      /*
       * (E) Visual affordance for the expand button when active.
       * (Optional) Rotate icon or change color. Keeping minimal now; hook provided.
       */
      .description-group .expand-button[aria-pressed="true"] {
        filter: brightness(0.9);
      }

      .edit-card-form .card {
        margin-bottom: auto;
      }

      .form-group > label {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
      }

      .flex-row {
        display: flex;
        flex-direction: row;
      }

      .space-between {
        justify-content: space-between;
      }
    `,
  ];
  private cardData = new Task(this, {
    args: () => [],
    task: async () => {
      const data = await miro.board.ui.getModalData<CardData>();
      invariant(data, "Missing panel data");
      return data;
    },
  });

  @state()
  private cardEdits: Partial<CardData> = {};

  private cardsAroundCursor: CardsAroundCursorController | undefined;
  private _socketProvider = new SocketProvider(this, (socket) => {
    this.cardsAroundCursor = new CardsAroundCursorController(this, socket);
  });

  private _miroTags = new Task(this, {
    args: () => [],
    task: async () => miro.board.get({ type: "tag" }),
  });

  jumpToCode = () => {
    const appCard = this.cardData.value;
    const socket = this._socketProvider.value;
    try {
      if (appCard && socket) {
        socket.emit("navigateTo", appCard);
        miro.board.notifications.showInfo("Opening card in VSCode");
        miro.board.ui.closeModal();
      }
    } catch (error) {
      debug.error("AppExplorer: Error opening app card", error);
    }
  };

  handleSubmit = (e: SubmitEvent) => {
    const data = this.cardData.value;
    e.preventDefault();
    miro.board.ui.closeModal({ ...data, ...this.cardEdits });
  };

  @state()
  private _expandDescription = false;

  render() {
    const symbolsAroundCursor = this.cardsAroundCursor?.value ?? [];

    return this.cardData.render({
      initial: () => html`<p>Loading...</p>`,
      complete: (data: CardData) => {
        const merged = { ...data, ...this.cardEdits };
        const cardData: CardData = { ...merged, tags: merged.tags ?? [] };
        return html`
          <form
            class=${classNames("edit-card-form", {
              "description-expanded": this._expandDescription,
            })}
            @submit=${this.handleSubmit}
          >
            <app-card class="card" .cardData=${cardData}></app-card>
            <div class="form-group">
              <label for="title">Title</label>
              <input
                autofocus
                class="input"
                type="text"
                value=${cardData.title}
                @input=${(e: InputEvent) => {
                  this.cardEdits = {
                    ...this.cardEdits,
                    title: (e.target as HTMLInputElement).value,
                  };
                }}
                id="title"
              />
            </div>
            <div class=${classNames("form-group description-group", {})}>
              <label for="description"
                >description

                <button
                  @click=${() =>
                    (this._expandDescription = !this._expandDescription)}
                  class="button button-primary button-small expand-button"
                  type="button"
                  aria-label="label"
                  aria-expanded=${this._expandDescription ? "true" : "false"}
                  aria-pressed=${this._expandDescription ? "true" : "false"}
                >
                  <span class="icon-expand"></span>
                </button>
              </label>
              <textarea
                class=${classNames("textarea")}
                type="text"
                @input=${(e: InputEvent) => {
                  this.cardEdits = {
                    ...this.cardEdits,
                    description: (e.target as HTMLInputElement).value,
                  };
                }}
                .value=${cardData.description ?? ""}
                id="description"
                rows="3"
              ></textarea>
            </div>
            <div class="form-group">
              <label>Tags</label>
              <app-explorer-tags-control
                .tags=${cardData.tags || []}
                .onTagClick=${(toggleTag: Tag) => {
                  let tags = cardData.tags ?? [];
                  if (tags.some((tag) => tag.id === toggleTag.id)) {
                    tags = tags.filter((tag) => tag.id !== toggleTag.id);
                  } else {
                    tags = [
                      ...(tags ?? []),
                      {
                        id: toggleTag.id,
                        title: toggleTag.title,
                        color: toggleTag.color,
                      },
                    ];
                  }

                  this.cardEdits = {
                    ...this.cardEdits,
                    tags,
                  };
                }}
              ></app-explorer-tags-control>
            </div>
            <div class="form-group">
              <label for="symbol">Symbol Path</label>
              <select
                id="symbol"
                class="select"
                @change=${(e: InputEvent) => {
                  const [path, symbol] = (
                    e.target as HTMLSelectElement
                  ).value.split("\n");

                  this.cardEdits = {
                    ...this.cardEdits,
                    path,
                    symbol,
                  };
                }}
              >
                <option
                  value=${data.path + "\n" + data.symbol}
                  ?selected=${data.symbol === cardData.symbol}
                >
                  ${data.symbol}
                </option>
                ${symbolsAroundCursor.map(
                  (card) => html`
                    <option
                      value=${card.path + "\n" + card.symbol}
                      ?selected=${card.symbol === cardData.symbol}
                    >
                      ${card.symbol}
                    </option>
                  `,
                )}
              </select>
            </div>

            <div class="flex-row space-between">
              <button
                class="button button-secondary"
                type="button"
                @click=${this.jumpToCode}
              >
                Jump to Code
              </button>
              <button class="button button-primary" type="submit">Save</button>
            </div>
          </form>
        `;
      },

      error: (_error) => html`<p>Error loading card data ${String(_error)}</p>`,
    });
  }
}
