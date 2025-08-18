import { useUIStore } from "@/hooks/store/use-ui-store";
import { Headline } from "@/ui/design-system/molecules";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { latestFeatures } from "@/ui/features/world";
import { latestFeatures as featuresData } from "@/ui/features/world/latest-features";

export const LatestFeaturesWindow = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(latestFeatures));

  if (!isOpen) return null;

  return (
    <SecondaryPopup name="latest-features" className="pointer-events-auto">
      <SecondaryPopup.Head onClose={() => togglePopup(latestFeatures)}>Latest Features</SecondaryPopup.Head>
      <SecondaryPopup.Body height="h-96" width="500px">
        <div className="flex flex-col space-y-4 p-6 overflow-y-auto h-full">
          <Headline>Recent Features & Improvements ({featuresData.length})</Headline>

          {featuresData.length === 0 ? (
            <div className="text-gold/60 text-center py-8">No features to display.</div>
          ) : (
            <div className="space-y-3">
              {featuresData.map((feature, index) => (
                <div key={index} className="flex flex-col p-4 bg-brown/20 border border-gold/20 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-gold text-sm font-medium">{feature.title}</span>
                    <span className="text-gold/60 text-xs flex-shrink-0 ml-4">{feature.date}</span>
                  </div>
                  {feature.description && (
                    <p className="text-gold/80 text-xs mt-2 leading-relaxed">{feature.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gold/20">
            <p className="text-gold/60 text-xxs">
              This list shows the latest features and UX improvements added to the game.
            </p>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
