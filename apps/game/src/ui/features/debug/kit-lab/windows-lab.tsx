import { GameProvider } from "@/hooks/context/game-context";
import { useDocumentClass } from "@/hooks/use-document-class";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";
import { openTransfer } from "@/ui/features/economy/transfers/transfer-window";
import { EventLogPanel } from "@/ui/features/event-feed/event-log-panel";
import { HintModal } from "@/ui/features/progression/hints/hint-modal";
import { ProductionModal } from "@/ui/features/settlement/production/production-modal-content";
import { StructureEditPopup } from "@/ui/features/world/components/structure-edit-popup";
import { ConstructionModal } from "@/ui/features/world/containers/construction-modal";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { installFixtureGame, PLAYER } from "./fixture-game";

/** The fixture's realm, which every window opens on. */
const REALM = 7;

/** Opens a window that lives on the popover host, the way its button opens it in the game. */
const Opened = ({ open }: { open: () => void }) => {
  const [first] = useState(() => open);
  useEffect(first, [first]);
  return null;
};

/**
 * Each window of the HUD's windows and modals, by the name in its address: the real component, as its button opens it.
 * Windows that hang from the popover host are opened through it; the rest are mounted where the game mounts them.
 */
const SURFACES: Record<string, { name: string; draw: () => ReactNode }> = {
  build: { name: "Build", draw: () => <ConstructionModal structureEntityId={REALM} /> },
  production: { name: "Production", draw: () => <ProductionModal preSelectedRealmId={REALM} /> },
  transfer: {
    name: "Transfer",
    draw: () => <Opened open={() => openTransfer({ sourceId: REALM, destinationIds: [] })} />,
  },
  lordpedia: { name: "Lordpedia", draw: () => <HintModal /> },
  "structure-edit": {
    name: "Edit structure",
    draw: () => (
      <StructureEditPopup
        currentName="Egonal"
        originalName="Egonal"
        groupColor={null}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onUpdateColor={() => undefined}
      />
    ),
  },
  log: { name: "Log", draw: () => <EventLogPanel onDismiss={() => undefined} isInsideAnchor={() => false} /> },
};

/**
 * Dev only: the windows and modals of the HUD (areas B and C of the style-sheet migration), each the real component on
 * the lab's fixture game, at /lab/kit/windows/<surface>, so a window reads the same before and after it moves onto the
 * sheet at 1920×1080.
 */
export const WindowsLab = () => {
  useDocumentClass("classic-hud");
  const [store] = useState(installFixtureGame);
  const { surface = "build" } = useParams();
  const shown = SURFACES[surface];
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
      <div className="relative min-h-screen bg-[#0b1418]">
        <nav data-lab-chrome className="flex flex-wrap gap-3 p-3 text-sm text-white/70">
          {Object.entries(SURFACES).map(([key, { name }]) => (
            <Link key={key} to={`/lab/kit/windows/${key}`} className={key === surface ? "text-white" : undefined}>
              {name}
            </Link>
          ))}
        </nav>
        <div data-lab-stage className="flex justify-center p-6">
          {shown ? shown.draw() : <p className="text-white">No window named {surface}.</p>}
        </div>
        <SurfaceHost />
        <Tooltip />
      </div>
    </GameProvider>
  );
};
