import { ID } from "@bibliothecadao/eternum";

export const HelpContainer = ({
  selectedEntityId,
  targetHex,
}: {
  selectedEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 max-w-4xl mx-auto">
      <div className="p-6 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm text-center">
        <h3 className="text-2xl font-bold text-gold mb-4">Help Other Armies</h3>
        <p className="text-gold/80">
          This feature will allow you to merge troops with other armies or add defence to a structure.
        </p>
        <p className="text-gold/60 mt-2">Work in progress - check back soon!</p>
      </div>
    </div>
  );
};
