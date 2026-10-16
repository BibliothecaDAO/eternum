import { act } from "react";

/** An open surface's panel, by its surface id. */
export const panelOf = (id: string) => document.querySelector<HTMLElement>(`[data-popover-panel="${id}"]`);

/** Where an open surface stands: its transform (a drag shows as a `translate`) and its top. */
export const placementOf = (id: string) => [panelOf(id)?.style.transform, panelOf(id)?.style.top];

/** Drags an open surface by its header, as a player's pointer does. */
export const dragHeader = async (id: string, by: { x: number; y: number }) => {
  const panel = panelOf(id);
  const header = panel?.querySelector("[data-popover-drag-handle]");
  const pointer = (type: string, at: { x: number; y: number }) =>
    new MouseEvent(type, { bubbles: true, clientX: at.x, clientY: at.y });
  await act(async () => header?.dispatchEvent(pointer("pointerdown", { x: 100, y: 100 })));
  await act(async () => panel?.dispatchEvent(pointer("pointermove", { x: 100 + by.x, y: 100 + by.y })));
  await act(async () => panel?.dispatchEvent(pointer("pointerup", { x: 100 + by.x, y: 100 + by.y })));
};
