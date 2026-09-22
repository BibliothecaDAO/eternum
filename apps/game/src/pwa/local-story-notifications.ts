import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useNotificationPreferenceStore } from "@/hooks/use-notification-preferences";
import { getActiveGame } from "@/runtime/world";
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
  buildStoryNotification,
  readNotificationStory,
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
  const world = getActiveGame();
  const route = parsePlayRoute(window.location);
  if (
    !world ||
    !route ||
    world.gameId !== scope.gameId ||
    world.chainId !== scope.chainId ||
    route.chainId !== world.chainId ||
    route.gameId !== world.gameId
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
    current.world.chainId === expected.world.chainId &&
    current.world.gameId === expected.world.gameId &&
    current.preference === expected.preference
  );
}

function buildEligibleNotification(value: Record<string, unknown>, scope: StoryEventScope, context: DeliveryContext) {
  const { story, payload } = readNotificationStory(value);
  if (
    !includesStoryNotification(context.preference.level, story) ||
    !storyRecipients(story, value.owner, payload).includes(`0x${BigInt(context.account).toString(16)}`)
  )
    return null;
  return buildStoryNotification({
    sourceId: storyEventIdentity(scope, value),
    value,
    owner: context.identity,
    gameName: context.world.name,
    target: buildEntryHref({
      chainId: context.world.chainId,
      gameId: context.world.gameId,
      intent: "play",
      autoSettle: false,
    }),
    now: Date.now(),
  });
}
