import Button from "@/ui/design-system/atoms/button";
import { MaxButton } from "@/ui/design-system/atoms/max-button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Tabs } from "@/ui/design-system/atoms/tab";
import TextInput from "@/ui/design-system/atoms/text-input";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { NewsHeadlineBanner } from "@/ui/features/news-headlines/news-headline-banner";
import { BootLoaderShell } from "@/ui/modules/boot-loader";
import { useState } from "react";

import { Element } from "./sheet-element";

/**
 * The app's own shared surfaces as the game renders them, the real components and not their sheet samples: the
 * loading screen, the news banner, a SurfaceFrame window and the older atoms other screens still press. Each sits in a
 * transformed box, so a fixed or portalled surface stays inside its frame for the capture.
 */
export const AppSurfacesSection = () => {
  const [amount, setAmount] = useState(1_200);
  const [name, setName] = useState("Egonal");
  return (
    <Element
      name="App surfaces"
      wide
      rule="The real components the whole app shares, rendered as the game renders them: the loading screen, the news banner, a framed window and the older atoms."
      sheet={
        <div data-app-surfaces className="grid grid-cols-2 gap-4">
          <figure className="relative h-96 overflow-hidden rounded-lg [transform:translateZ(0)]">
            <BootLoaderShell
              showBackdrop={false}
              progress={40}
              caption="Initializing"
              title="Entering the World"
              subtitle="Connecting to the world…"
            />
          </figure>
          <figure className="relative h-96 overflow-hidden rounded-lg [transform:translateZ(0)]">
            <NewsHeadlineBanner
              headline={{
                id: "lab",
                type: "realm-fall",
                icon: "realm-fall",
                title: "Xeswet has fallen",
                description: "Moonhand took it from Kestrel.",
                location: { x: 0, y: 0, entityId: 1 },
                timestamp: 0,
              }}
              onDismiss={() => undefined}
              onNavigate={() => undefined}
            />
          </figure>
          <figure className="h-80">
            <SurfaceFrame
              title="Transfer"
              icon="transfer"
              onClose={() => undefined}
              footer={<Button variant="gold">Send</Button>}
              className="h-full w-full"
            >
              <p className="p-4">The body scrolls inside the frame.</p>
            </SurfaceFrame>
          </figure>
          <figure className="flex flex-col gap-3 p-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="gold">Gold</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="red">Red</Button>
              <Button variant="default" size="xs">
                Small
              </Button>
              <Button variant="primary" isLoading>
                Loading
              </Button>
            </div>
            <Tabs variant="default">
              <Tabs.List>
                <Tabs.Tab>Realms</Tabs.Tab>
                <Tabs.Tab>Camps</Tabs.Tab>
              </Tabs.List>
            </Tabs>
            <NumberInput value={amount} onChange={setAmount} max={5_000} />
            <TextInput value={name} onChange={setName} />
            <MaxButton max={5_000} onChange={(value) => setAmount(Number(value))} />
          </figure>
        </div>
      }
      today={
        <span className="text-sm text-white/70">
          These are the game's own components, so this column is the sheet column: compare with the captures taken on
          the commit before the migration.
        </span>
      }
    />
  );
};
