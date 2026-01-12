import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import Button from "@/ui/design-system/atoms/button";
import { Position } from "@bibliothecadao/eternum";
import { useDojo, usePlayerOwnedRealmEntities } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { AlertCircle, Eye, Swords, Trophy } from "lucide-react";
import { fadeInUp } from "../../animations";
import { SettleStage } from "../../types";
import { formatLocalDateTime } from "../../utils";
import { CountdownTimer } from "../CountdownTimer";
import { SettlementWizard } from "../SettlementWizard";

interface GameActiveStateProps {
  isRegistered: boolean;
  hasSettled: boolean;
  canPlay: boolean;
  gameEndAt?: number;
  onSettle: () => Promise<void>;
  onSpectate?: () => void;
  settleStage: SettleStage;
  assignedRealmCount: number;
  settledRealmCount: number;
  isSettling: boolean;
  className?: string;
}

export const GameActiveState = ({
  isRegistered,
  hasSettled,
  canPlay,
  gameEndAt,
  onSettle,
  onSpectate,
  settleStage,
  assignedRealmCount,
  settledRealmCount,
  isSettling,
  className = "",
}: GameActiveStateProps) => {
  const { setup } = useDojo();
  const { components } = setup;
  const goToStructure = useGoToStructure(setup);
  const realmEntities = usePlayerOwnedRealmEntities();

  const handlePlay = () => {
    const firstRealm = realmEntities[0];
    if (!firstRealm) return;

    const structure = getComponentValue(components.Structure, firstRealm);
    if (!structure) return;

    void goToStructure(
      structure.entity_id,
      new Position({ x: structure.base.coord_x, y: structure.base.coord_y }),
      false,
    );
  };

  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Swords className="w-6 h-6 text-gold" />
          <h3 className="text-xl font-bold text-gold">Game Active</h3>
        </div>
        <p className="text-gold/70">The battle for supremacy has begun!</p>

        {/* Game timer */}
        {gameEndAt && (
          <div className="space-y-2">
            <CountdownTimer targetTime={gameEndAt} label="Game ends in:" />
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-sm">
              <p className="text-gold/60 text-xs">Ends at: {formatLocalDateTime(gameEndAt)}</p>
              <p className="text-gold font-semibold mt-2 flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4" />
                Conquer everything to win
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content based on registration state */}
      <div className="space-y-4">
        {isRegistered ? (
          <>
            {canPlay ? (
              <PlayButton onClick={handlePlay} />
            ) : (
              <SettlementWizard
                stage={settleStage}
                assignedCount={assignedRealmCount}
                settledCount={settledRealmCount}
                isSettling={isSettling}
                onSettle={onSettle}
              />
            )}
          </>
        ) : (
          <NotRegisteredBanner onSpectate={onSpectate} />
        )}
      </div>
    </motion.div>
  );
};

// Play button sub-component
const PlayButton = ({ onClick }: { onClick: () => void }) => (
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
      <p className="text-emerald-400 font-medium">Your realm is ready!</p>
      <p className="text-xs text-gold/60 mt-1">Enter the game and start your conquest</p>
    </div>

    <Button onClick={onClick} className="w-full h-14 !text-brown !bg-gold rounded-md" forceUppercase={false}>
      <div className="flex items-center justify-center gap-3">
        <Sword className="w-6 h-6 fill-brown" />
        <span className="text-lg font-bold">Play Blitz </span>
      </div>
    </Button>
  </motion.div>
);

// Not registered banner sub-component
const NotRegisteredBanner = ({ onSpectate }: { onSpectate?: () => void }) => (
  <div className="bg-brown/20 border border-brown/40 rounded-lg p-4 text-center space-y-3">
    <AlertCircle className="w-8 h-8 mx-auto text-gold/50" />
    <div>
      <p className="text-gold/70 font-medium">You are not registered for this game</p>
      <p className="text-xs text-gold/50 mt-1">Registration has closed. You can spectate or wait for the next game.</p>
    </div>
    {onSpectate && (
      <Button onClick={onSpectate} variant="outline" size="md" forceUppercase={false}>
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span>Spectate Game</span>
        </div>
      </Button>
    )}
  </div>
);
