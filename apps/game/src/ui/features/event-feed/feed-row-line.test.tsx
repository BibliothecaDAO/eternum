import { renderToStaticMarkup } from "react-dom/server";
import { TransactionType } from "@bibliothecadao/provider";
import { describe, expect, it, vi } from "vitest";
import { FeedRowLine } from "./feed-row-line";

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRow: () => undefined }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useNavigateToMapView: () => vi.fn() }));

describe("Transfer in the event feed", () => {
  it.each(["pending", "checking", "success", "reverted", "not_sent"] as const)(
    "keeps the donkey while %s",
    (status) => {
      const html = renderToStaticMarkup(
        <FeedRowLine
          row={{
            kind: "transaction",
            id: "transfer",
            at: 0,
            transaction: {
              hash: "0x1",
              type: TransactionType.SEND,
              status,
              submittedAt: 0,
              description: "Transfer resources",
            },
          }}
        />,
      );
      expect(html).toContain('data-icon="transfer"');
      expect(html).toContain("/icons/facets/64/donkey.webp");
      expect(html).toContain(status === "success" ? "Caravan sent" : "Transfer resources");
    },
  );
});
