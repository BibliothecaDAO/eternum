import { useGame } from "@/hooks/context/game-context";
import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import type { ID } from "@bibliothecadao/types";
import { resolveRealmBootstrapErrorMessage } from "./realm-bootstrap-error";
import { useBlitzRealmProvision } from "./use-blitz-realm-provision";
import { useStructureUpgrade } from "./use-structure-upgrade";

type Upgrade = NonNullable<ReturnType<typeof useStructureUpgrade>>;
type Provision = ReturnType<typeof useBlitzRealmProvision>;

/** A realm's level-up step: what it is, what its button says, and whether it can be taken now. */
export type LevelUpStep = {
  /** Provision first (a fresh Blitz realm, in one transaction with the first level when affordable), then level up. */
  mode: "provision" | "level-up" | "max";
  /** The verb a button shows: "Provision", "Level up to City", "Fully upgraded". */
  word: string;
  /** It can be taken now. */
  ready: boolean;
  /** A step for this realm is in flight, from this surface or another. */
  loading: boolean;
  /** Why it cannot be taken, when it cannot and nothing is in flight. */
  refusal: string | null;
};

export type RealmLevelUp = LevelUpStep & {
  currentLevel: number;
  nextLevel: number;
  nextLevelName: string | null;
  requirements: Upgrade["requirements"];
  /** Sends the step when it is ready, and nothing otherwise. */
  run: () => void;
};

/**
 * The step from the game's own readiness: provision while a Blitz realm still needs it, then the plain level-up,
 * until the last level. Its in-flight lock is the castle's, which every level-up and provision send holds.
 */
const resolveLevelUpStep = (upgrade: Upgrade, provision: Provision): LevelUpStep => {
  if (upgrade.isMaxLevel) return { mode: "max", word: "Fully upgraded", ready: false, loading: false, refusal: null };
  const loading = upgrade.isUpgradeLocked;
  if (provision?.needsBootstrap) {
    const ready = provision.canProvision && !loading;
    const refusal = ready || loading ? null : "Opens when the game starts";
    return { mode: "provision", word: "Provision", ready, loading, refusal };
  }
  const word = upgrade.nextLevelName ? `Level up to ${upgrade.nextLevelName}` : "Level up";
  const ready = upgrade.isOwner && upgrade.canUpgrade && !loading;
  return { mode: "level-up", word, ready, loading, refusal: ready || loading ? null : levelUpRefusal(upgrade) };
};

const levelUpRefusal = (upgrade: Upgrade): string => {
  if (!upgrade.isOwner) return "Not your realm";
  if (!upgrade.hasRecipe) return "This game has no recipe for the next level";
  return "Need resources";
};

/** The realm's one level-up step. Every surface that offers it reads and sends it here. */
export const useRealmLevelUp = (structureEntityId: ID | null): RealmLevelUp | null => {
  const { setup, account } = useGame();
  const entityId = typeof structureEntityId === "number" ? structureEntityId : null;
  const upgrade = useStructureUpgrade(entityId);
  const provision = useBlitzRealmProvision(entityId);
  if (!upgrade || entityId === null) return null;

  const step = resolveLevelUpStep(upgrade, provision);
  const signer = account.account;
  const provisionRealm = () =>
    sendOnce("castle", entityId, true, () =>
      setup.systemCalls.provision_realm({ signer, realm_entity_id: entityId, upgrade: upgrade.canUpgrade }),
    ).catch((error) => toast.error(resolveRealmBootstrapErrorMessage(error)));
  const levelUp = () =>
    sendOnce("castle", entityId, true, () =>
      setup.systemCalls.upgrade_realm({ signer, realm_entity_id: entityId }),
    ).catch((error) => toast.error(extractReadableErrorMessage(error, "Level up failed.")));

  return {
    ...step,
    currentLevel: upgrade.currentLevel,
    nextLevel: upgrade.nextLevel ?? 0,
    nextLevelName: upgrade.nextLevelName,
    requirements: upgrade.requirements,
    run: () => {
      if (step.ready) void (step.mode === "provision" ? provisionRealm() : levelUp());
    },
  };
};
