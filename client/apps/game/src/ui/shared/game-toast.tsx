import { ResourcesIds, resources } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { isValidElement } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";

export type GameToastResourceItem = {
  resourceId: ResourcesIds | number;
  amount?: number | string;
  label?: string;
};

type GameToastThingItem = {
  label: string;
  icon?: string;
};

export type GameToastModel = {
  title: ReactNode;
  description?: ReactNode;
  resources?: GameToastResourceItem[];
  things?: GameToastThingItem[];
};

type GameToastInput = ReactNode | GameToastModel;
type GameToastFunction = ((message: GameToastInput, data?: ExternalToast) => string | number) & {
  success: (message: GameToastInput, data?: ExternalToast) => string | number;
  info: (message: GameToastInput, data?: ExternalToast) => string | number;
  warning: (message: GameToastInput, data?: ExternalToast) => string | number;
  error: (message: GameToastInput, data?: ExternalToast) => string | number;
  message: (message: GameToastInput, data?: ExternalToast) => string | number;
  loading: (message: GameToastInput, data?: ExternalToast) => string | number;
  custom: typeof sonnerToast.custom;
  dismiss: typeof sonnerToast.dismiss;
};

type ToastTerm =
  | {
      kind: "resource";
      label: string;
      iconLabel: string;
      resourceId: ResourcesIds;
      aliases: string[];
    }
  | {
      kind: "thing";
      label: string;
      icon: string;
      aliases: string[];
    };

const GAME_TOAST_THINGS: ToastTerm[] = [
  { kind: "thing", label: "Realm", icon: "/images/labels/realm.png", aliases: ["Realm", "Realms"] },
  { kind: "thing", label: "Village", icon: "/images/labels/village.png", aliases: ["Village", "Villages"] },
  { kind: "thing", label: "Army", icon: "/images/labels/army.png", aliases: ["Army", "Armies", "Troops"] },
  { kind: "thing", label: "Chest", icon: "/images/labels/chest.png", aliases: ["Chest", "Chests"] },
  { kind: "thing", label: "Quest", icon: "/images/labels/quest.png", aliases: ["Quest", "Quests"] },
  {
    kind: "thing",
    label: "Hyperstructure",
    icon: "/images/labels/hyperstructure.png",
    aliases: ["Hyperstructure", "Hyperstructures"],
  },
  { kind: "thing", label: "Automation", icon: "/image-icons/robot.png", aliases: ["Automation", "Automations"] },
  { kind: "thing", label: "Transfer", icon: "/image-icons/transfer.png", aliases: ["Transfer", "Transfers"] },
  { kind: "thing", label: "Market", icon: "/image-icons/trade.png", aliases: ["Market", "Markets"] },
  { kind: "thing", label: "Guild", icon: "/image-icons/guild.png", aliases: ["Guild", "Guilds", "Tribe", "Tribes"] },
  { kind: "thing", label: "Building", icon: "/image-icons/construction.png", aliases: ["Building", "Buildings"] },
  { kind: "thing", label: "Wallet", icon: "/image-icons/network.png", aliases: ["Wallet", "Network"] },
  { kind: "thing", label: "Rewards", icon: "/images/buildings/thumb/rewards.png", aliases: ["Reward", "Rewards"] },
  { kind: "thing", label: "Relic", icon: "/image-icons/relics.png", aliases: ["Relic", "Relics"] },
  { kind: "thing", label: "Resources", icon: "/image-icons/resources.png", aliases: ["Resource", "Resources"] },
];

const enumResourceTerms = Object.values(ResourcesIds)
  .filter((value): value is string => typeof value === "string")
  .map((label) => ({
    label,
    resourceId: ResourcesIds[label as keyof typeof ResourcesIds],
  }))
  .filter((entry): entry is { label: string; resourceId: ResourcesIds } => typeof entry.resourceId === "number");

const RESOURCE_TERMS: ToastTerm[] = resources.map((resource) => {
  const enumLabel = enumResourceTerms.find((entry) => entry.resourceId === resource.id)?.label;
  return {
    kind: "resource",
    label: resource.trait,
    iconLabel: enumLabel ?? resource.trait,
    resourceId: resource.id,
    aliases: [...new Set([resource.trait, enumLabel].filter((alias): alias is string => Boolean(alias)))],
  };
});

const TOAST_TERMS = [...RESOURCE_TERMS, ...GAME_TOAST_THINGS] as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const amountPattern = String.raw`\d+(?:,\d{3})*(?:\.\d+)?`;
const termPattern = TOAST_TERMS.flatMap((term) => term.aliases)
  .toSorted((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join("|");
const termRegex = new RegExp(`(?<![A-Za-z0-9])(?:(${amountPattern})\\s+)?(${termPattern})(?![A-Za-z0-9])`, "gi");

const normalizeTerm = (value: string): string => value.toLowerCase().replace(/\s+/g, "");
const TERM_BY_ALIAS = new Map<string, ToastTerm>(
  TOAST_TERMS.flatMap((term) => term.aliases.map((alias) => [normalizeTerm(alias), term] as const)),
);

const resolveResourceLabel = (resourceId: ResourcesIds | number, fallback?: string): string => {
  const resource = resources.find((entry) => entry.id === resourceId);
  if (resource) return resource.trait;
  const enumLabel = ResourcesIds[resourceId as ResourcesIds];
  if (typeof enumLabel === "string") return enumLabel;
  return fallback ?? `Resource ${resourceId}`;
};

const resolveResourceIconLabel = (resourceId: ResourcesIds | number, label: string): string => {
  const enumLabel = ResourcesIds[resourceId as ResourcesIds];
  return typeof enumLabel === "string" ? enumLabel : label;
};

const resolveThingIcon = (item: GameToastThingItem): string | null => {
  const registryTerm = TERM_BY_ALIAS.get(normalizeTerm(item.label));
  if (registryTerm?.kind === "thing") return registryTerm.icon;
  return item.icon ?? null;
};

const formatResourceAmount = (amount: GameToastResourceItem["amount"]): string | null => {
  if (amount === undefined || amount === null) return null;
  if (typeof amount === "string") return amount;
  return Math.round(amount).toLocaleString();
};

const ResourceToastChip = ({
  amount,
  iconLabel,
  label,
}: {
  amount?: string | null;
  iconLabel: string;
  label: string;
}) => (
  <span
    data-game-toast-resource={label}
    className="inline-flex items-center gap-1 rounded bg-gold/10 px-1.5 py-0.5 align-middle text-gold"
  >
    <ResourceIcon resource={iconLabel} size="xs" withTooltip={false} className="!h-4 !w-4 shrink-0" />
    <span>{amount ? `${amount} ${label}` : label}</span>
  </span>
);

const ThingToastChip = ({ icon, label }: { icon: string; label: string }) => (
  <span
    data-game-toast-thing={label}
    className="inline-flex items-center gap-1 rounded bg-gold/10 px-1.5 py-0.5 align-middle text-gold"
  >
    <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
    <span>{label}</span>
  </span>
);

const renderMatchedTerm = (term: ToastTerm, amount: string | undefined, key: string): ReactNode => {
  if (term.kind === "resource") {
    return <ResourceToastChip key={key} amount={amount} iconLabel={term.iconLabel} label={term.label} />;
  }

  return (
    <span key={key}>
      {amount ? `${amount} ` : null}
      <ThingToastChip icon={term.icon} label={term.label} />
    </span>
  );
};

const renderTextWithIcons = (text: string): ReactNode => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(termRegex)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
    }

    const amount = match[1];
    const matchedTerm = match[2] ?? "";
    const term = TERM_BY_ALIAS.get(normalizeTerm(matchedTerm));
    nodes.push(term ? renderMatchedTerm(term, amount, `${matchIndex}-${matchedTerm}`) : match[0]);
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : text;
};

const isGameToastModel = (value: GameToastInput): value is GameToastModel =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !isValidElement(value) && "title" in value;

const renderGameToastContent = (content: ReactNode): ReactNode =>
  typeof content === "string" ? renderTextWithIcons(content) : content;

const renderStructuredResources = (items: GameToastResourceItem[] | undefined) =>
  items?.map((item) => {
    const label = item.label ?? resolveResourceLabel(item.resourceId);
    return (
      <ResourceToastChip
        key={`${item.resourceId}-${label}-${String(item.amount ?? "")}`}
        amount={formatResourceAmount(item.amount)}
        iconLabel={resolveResourceIconLabel(item.resourceId, label)}
        label={label}
      />
    );
  });

const renderStructuredThings = (items: GameToastThingItem[] | undefined) =>
  items?.map((item) => {
    const icon = resolveThingIcon(item);
    return icon ? (
      <ThingToastChip key={`${item.label}-${icon}`} icon={icon} label={item.label} />
    ) : (
      <span key={item.label}>{item.label}</span>
    );
  });

const GameToastDescription = ({
  description,
  resources: resourceItems,
  things,
}: Pick<GameToastModel, "description" | "resources" | "things">) => {
  const resourceChips = renderStructuredResources(resourceItems);
  const thingChips = renderStructuredThings(things);
  const hasChips = Boolean(resourceChips?.length || thingChips?.length);

  if (!description && !hasChips) return null;

  return (
    <span className="flex flex-col gap-1.5">
      {description ? <span>{renderGameToastContent(description)}</span> : null}
      {hasChips ? (
        <span className="flex flex-wrap gap-1.5">{[...(thingChips ?? []), ...(resourceChips ?? [])]}</span>
      ) : null}
    </span>
  );
};

export const GameToastContent = ({ content }: { content: ReactNode }) => <>{renderGameToastContent(content)}</>;

const buildToastMessage = (message: GameToastInput): ReactNode => {
  if (isGameToastModel(message)) {
    return <GameToastContent content={message.title} />;
  }

  return <GameToastContent content={message} />;
};

const buildToastDescription = (message: GameToastInput, data?: ExternalToast): ExternalToast["description"] => {
  const baseDescription = data?.description;
  const isModel = isGameToastModel(message);
  const description = isModel ? (message.description ?? baseDescription) : baseDescription;
  const resources = isModel ? message.resources : undefined;
  const things = isModel ? message.things : undefined;
  const hasChips = Boolean(resources?.length || things?.length);

  if (!description && !hasChips) return undefined;

  if (typeof description === "function") {
    return () => <GameToastDescription description={description()} resources={resources} things={things} />;
  }

  return <GameToastDescription description={description} resources={resources} things={things} />;
};

const buildToastOptions = (message: GameToastInput, data?: ExternalToast): ExternalToast | undefined => {
  const description = buildToastDescription(message, data);

  return description ? { ...data, description } : data;
};

const callToast =
  (method: (message: ReactNode, data?: ExternalToast) => string | number) =>
  (message: GameToastInput, data?: ExternalToast): string | number =>
    method(buildToastMessage(message), buildToastOptions(message, data));

export const gameToast = Object.assign(callToast(sonnerToast), {
  success: callToast(sonnerToast.success),
  info: callToast(sonnerToast.info),
  warning: callToast(sonnerToast.warning),
  error: callToast(sonnerToast.error),
  message: callToast(sonnerToast.message),
  loading: callToast(sonnerToast.loading),
  custom: sonnerToast.custom,
  dismiss: sonnerToast.dismiss,
}) as GameToastFunction;
