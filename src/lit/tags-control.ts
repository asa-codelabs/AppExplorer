/* global miro */

import { Task } from "@lit/task";
import { Tag } from "@mirohq/websdk-types";
import "@webcomponents/webcomponentsjs";
import classNames from "classnames";
import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CardData } from "../EventTypes";
import { createDebug } from "../utils/create-debug";
import "./app-card";
import { AppElement } from "./app-element";
import "./cards-around-cursor";
import { mirotoneStyles, rawMirotoneStyles } from "./mirotone";
import "./onboarding";
import "./server-status";
// Mirotone must be loaded on the host page to set all the CSS variables.
document.head.insertAdjacentHTML(
  "beforeend",
  `<style>${rawMirotoneStyles}</style>`,
);

const debug = createDebug("app-explorer:miro:edit-card");

@customElement("app-explorer-tags-control")
export class TagsControlElement extends AppElement {
  static styles = [
    mirotoneStyles,
    css`
      app-explorer-tags-control .tag {
        opacity: 0.6;

        &.active {
          opacity: 1;
        }
      }
    `,
  ];

  private _miroTags = new Task(this, {
    args: () => [],
    task: async () => miro.board.get({ type: "tag" }),
  });

  @property({ attribute: false })
  onTagClick: undefined | ((tagId: Tag) => void);

  @property({ type: Array })
  tags: CardData["tags"] | undefined;

  render() {
    return this._miroTags.render({
      initial: () => html``,
      complete: (tags) => {
        return html`
          ${tags.map(
            (tag) => html`
              <div
                tabindex="0"
                @click=${() => this.onTagClick?.(tag)}
                class=${classNames("tag", `tag-${tag.color}`, {
                  active: this.tags?.some((t) => t.id === tag.id),
                })}
              >
                ${tag.title}
              </div>
            `,
          )}
        `;
      },
    });
  }
}
