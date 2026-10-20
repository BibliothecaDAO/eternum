import Button from "@/ui/design-system/atoms/button";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { NewsHeadlineBanner } from "@/ui/features/news-headlines/news-headline-banner";
import { BootLoaderShell } from "@/ui/modules/boot-loader";

import { Element } from "./sheet-element";

/**
 * The app's own shared surfaces as the game renders them, the real components and not their sheet samples: the
 * loading screen, the news banner and a SurfaceFrame window. Each sits in a transformed box, so a fixed or portalled
 * surface stays inside its frame for the capture.
 */
export const AppSurfacesSection = () => {
  return (
    <Element
      name="App surfaces"
      wide
      rule="The real components the whole app shares, rendered as the game renders them: the loading screen, the news banner and a framed window."
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
                description: ["Moonhand took it from Kestrel."],
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
