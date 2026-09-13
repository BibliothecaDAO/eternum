import { expect, it } from "vitest";
import { eventConfirmationRank } from "./event-confirmation";

it("requires explicit confirmation and a valid block before treating an event as confirmed", () => {
  expect(eventConfirmationRank()).toBe(0);
  expect(eventConfirmationRank(null)).toBe(0);
  expect(eventConfirmationRank({ block: 12 } as never)).toBe(0);
  expect(eventConfirmationRank({ block: null, preconfirmed: false })).toBe(0);
  expect(eventConfirmationRank({ block: -1, preconfirmed: false })).toBe(0);
  expect(eventConfirmationRank({ block: 1.5, preconfirmed: false })).toBe(0);
  expect(eventConfirmationRank({ block: null, preconfirmed: true })).toBe(1);
  expect(eventConfirmationRank({ block: 12, preconfirmed: false })).toBe(2);
});
