import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useNotificationPreferenceStore } from "@/hooks/use-notification-preferences";
import { getActiveWorld } from "@/runtime/world";
import { buildEntryHref, parsePlayRoute } from "@/play/navigation/play-route";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import {
  eventConfirmationRank,
  storyEventIdentity,
  type GameSyncEntity,
  type GameSyncEventConfirmation,
  type StoryEventScope,
} from "@bibliothecadao/eternum/game-sync";
import {
  includesStoryNotification,
  logicalStoryIdentity,
  parseNotificationPayload,
  storyRecipients,
} from "@bibliothecadao/notifications";
import {
  localNotificationCapability,
  notificationWorkerRequest,
  readLocalNotificationDevice,
  reportNotificationDeliveryError,
} from "./local-notification-client";

/** Called only from the live event callback. History hydration never enters the OS delivery path. */
export function dispatchLocalStoryNotification(
  event: GameSyncEntity,
  scope: StoryEventScope,
  confirmation?: GameSyncEventConfirmation,
): void {
  if (
    confirmation?.confirmedAfterAttach !== true ||
    eventConfirmationRank(confirmation) !== 2 ||
    isExplicitSpectateSession()
  )
    return;
  const entry = Object.entries(event.models).find(([model]) => model === "StoryEvent" || model.endsWith("-StoryEvent"));
  if (!entry) return;
  void deliverStory(entry[1] as Record<string, unknown>, scope).catch(reportNotificationDeliveryError);
}

type DeliveryContext = NonNullable<ReturnType<typeof resolveDeliveryContext>>;

async function deliverStory(value: Record<string, unknown>, scope: StoryEventScope): Promise<void> {
  const context = resolveDeliveryContext(scope);
  if (!context) return;
  const notification = buildEligibleNotification(value, scope, context);
  if (!notification) return;
  const device = await readLocalNotificationDevice(context.identity);
  if (!device || notification.createdAt < device.enabledAt || !isCurrentDeliveryContext(scope, context)) return;
  await notificationWorkerRequest(context.identity, "deliver", { payload: notification, token: device.token });
}

function resolveDeliveryContext(scope: StoryEventScope) {
  const identity = useIdentitySessionStore.getState().session?.user.id;
  const account = useAccountStore.getState().account?.address;
  const preferences = useNotificationPreferenceStore.getState();
  if (
    !identity ||
    !account ||
    preferences.status !== "ready" ||
    preferences.saved?.owner !== identity ||
    preferences.saved.level === "off"
  )
    return null;
  if (localNotificationCapability() || Notification.permission !== "granted") return null;
  const world = getActiveWorld();
  const route = parsePlayRoute(window.location);
  if (
    !world ||
    !route ||
    world.gameId !== scope.gameId ||
    world.chain !== scope.chain ||
    BigInt(world.worldAddress) !== BigInt(scope.worldAddress) ||
    route.worldName !== world.name
  )
    return null;
  return { identity, account, preference: preferences.saved, world };
}

function isCurrentDeliveryContext(scope: StoryEventScope, expected: DeliveryContext): boolean {
  if (isExplicitSpectateSession()) return false;
  const current = resolveDeliveryContext(scope);
  return (
    current !== null &&
    current.identity === expected.identity &&
    current.account === expected.account &&
    current.world.worldAddress === expected.world.worldAddress &&
    current.world.name === expected.world.name &&
    current.preference === expected.preference
  );
}

function buildEligibleNotification(value: Record<string, unknown>, scope: StoryEventScope, context: DeliveryContext) {
  const variant = Object.entries(value.story as Record<string, unknown>);
  if (variant.length !== 1) throw new Error("Invalid notification story variant");
  const [story, rawPayload] = variant[0];
  const payload = rawPayload as Record<string, unknown>;
  if (
    !includesStoryNotification(context.preference.level, story) ||
    !storyRecipients(story, value.owner, payload).includes(`0x${BigInt(context.account).toString(16)}`)
  )
    return null;
  const createdAt = Number(value.timestamp) * 1000;
  if (createdAt + 120_000 <= Date.now()) return null;
  const title = story.replace(/Story$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
  return parseNotificationPayload(
    {
      version: 1,
      owner: context.identity,
      id: logicalStoryIdentity(storyEventIdentity(scope, value), story, value, payload),
      title: story === "BattleStory" ? "Battle confirmed" : title,
      body: `${context.world.name}: new confirmed activity involving you.`,
      target: buildEntryHref({
        chain: context.world.chain,
        worldName: context.world.name,
        intent: "play",
        autoSettle: false,
      }),
      createdAt,
      expiresAt: createdAt + 120_000,
    },
    Date.now(),
  );
}
