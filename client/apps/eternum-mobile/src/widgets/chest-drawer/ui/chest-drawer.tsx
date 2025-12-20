import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerHeader } from "@/shared/ui/drawer";
import { FELT_CENTER as getFeltCenterOffset } from "@bibliothecadao/eternum";
import { useComponentSystem, useDojo } from "@bibliothecadao/react";
import { isComponentUpdate } from "@dojoengine/recs";
import { useCallback, useState } from "react";
import { ChestDrawerProps, ChestState } from "../model/types";
import { ChestInteraction } from "./chest-interaction";
import { RelicCarousel } from "./relic-carousel";
import { RelicResultCards } from "./relic-result-cards";

export const ChestDrawer = ({ explorerEntityId, chestHex, open, onOpenChange }: ChestDrawerProps) => {
  const {
    account: { account },
    setup: { systemCalls },
    network: { contractComponents },
  } = useDojo();

  const [chestState, setChestState] = useState<ChestState>({
    isShaking: false,
    hasClicked: false,
    clickCount: 0,
    chestResult: null,
    showResult: false,
    isOpening: false,
    revealedCards: [],
  });
  const FELT_CENTER = getFeltCenterOffset();
  const chestName = `Chest at (${chestHex.x - FELT_CENTER}, ${chestHex.y - FELT_CENTER})`;

  // Event listener for OpenRelicChestEvent
  useComponentSystem(
    contractComponents.events.OpenRelicChestEvent,
    (update: any) => {
      if (!isComponentUpdate(update, contractComponents.events.OpenRelicChestEvent)) return;

      const [currentState] = update.value;

      if (
        currentState?.explorer_id === explorerEntityId &&
        currentState?.chest_coord?.x === chestHex.x &&
        currentState?.chest_coord?.y === chestHex.y
      ) {
        const relics = currentState.relics.map((relic: any) => relic.value);
        setChestState((prev) => ({ ...prev, chestResult: relics }));

        if (chestState.isOpening) {
          setTimeout(() => {
            setChestState((prev) => ({ ...prev, showResult: true }));

            relics.forEach((_: any, index: number) => {
              setTimeout(() => {
                setChestState((prev) => ({
                  ...prev,
                  revealedCards: [...prev.revealedCards, index],
                }));
              }, index * 600);
            });
          }, 500);
        } else {
          setChestState((prev) => ({
            ...prev,
            showResult: true,
            revealedCards: relics.map((_: any, index: number) => index),
          }));
        }
      }
    },
    [explorerEntityId, chestHex.x, chestHex.y, chestState.isOpening],
  );

  const handleChestClick = useCallback(async () => {
    if (chestState.showResult || chestState.isOpening) return;

    const newClickCount = chestState.clickCount + 1;
    setChestState((prev) => ({ ...prev, clickCount: newClickCount, isShaking: true }));

    setTimeout(() => {
      setChestState((prev) => ({ ...prev, isShaking: false }));
    }, 300);

    if (!chestState.hasClicked) {
      setChestState((prev) => ({ ...prev, hasClicked: true }));
      try {
        await systemCalls.open_chest({
          signer: account,
          explorer_id: explorerEntityId,
          chest_coord: {
            x: chestHex.x,
            y: chestHex.y,
          },
        });
      } catch (error) {
        console.error("Failed to open chest:", error);
      }
    }

    if (newClickCount >= 5) {
      setChestState((prev) => ({ ...prev, isOpening: true }));
      setTimeout(() => {
        if (!chestState.chestResult) {
          setChestState((prev) => ({ ...prev, showResult: true }));
        }
      }, 1500);
    }
  }, [chestState, account, systemCalls, explorerEntityId, chestHex]);

  const handleContinue = () => {
    onOpenChange(false);
    setChestState({
      isShaking: false,
      hasClicked: false,
      clickCount: 0,
      chestResult: null,
      showResult: false,
      isOpening: false,
      revealedCards: [],
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="!text-center">
          <h2 className="text-xl font-bold text-gold">✨ Open Relic Crate ✨</h2>
          <p className="text-sm text-gold/70">{chestName}</p>
        </DrawerHeader>

        <div className="flex-1 p-4 space-y-6 overflow-hidden">
          {!chestState.showResult ? (
            <>
              <ChestInteraction
                clickCount={chestState.clickCount}
                isShaking={chestState.isShaking}
                isOpening={chestState.isOpening}
                showResult={chestState.showResult}
                onChestClick={handleChestClick}
              />

              <RelicCarousel foundRelics={[]} />
            </>
          ) : (
            <div className="space-y-6">
              <RelicResultCards relics={chestState.chestResult || []} revealedCards={chestState.revealedCards} />

              <Button
                onClick={handleContinue}
                className="w-full bg-gold hover:bg-gold/90 text-dark-brown font-semibold"
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
