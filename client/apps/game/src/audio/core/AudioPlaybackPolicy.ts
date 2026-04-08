import { AudioCategory } from "../types";

export type PlaybackRejectionReason = "burst_limit" | "category_cap" | "cooldown";

export interface PlaybackRequest {
  assetId: string;
  category: AudioCategory;
  priority: number;
  nowMs: number;
}

export interface PlaybackRelease {
  assetId: string;
  category: AudioCategory;
}

export interface PlaybackDecision {
  allowed: boolean;
  reason?: PlaybackRejectionReason;
}

const DEFAULT_REPEAT_INTERVAL_MS = 50;
const BURST_WINDOW_MS = 300;
const MAX_BURST_EVENTS = 4;

const CATEGORY_CAPS: Record<AudioCategory, number> = {
  [AudioCategory.MUSIC]: 2,
  [AudioCategory.UI]: 3,
  [AudioCategory.RESOURCE]: 3,
  [AudioCategory.BUILDING]: 2,
  [AudioCategory.COMBAT]: 4,
  [AudioCategory.AMBIENT]: 2,
  [AudioCategory.ENVIRONMENT]: 2,
};

const ASSET_COOLDOWNS_MS = new Map<string, number>([
  ["ui.hover", 120],
  ["ui.click", 90],
  ["ui.slider_tick", 120],
  ["ui.msg_receive", 500],
  ["ui.msg_send", 150],
  ["ui.toast_info", 250],
  ["ui.tx_success", 250],
  ["ui.tx_fail", 250],
  ["unit.command.select", 180],
  ["unit.command.move", 180],
  ["unit.command.attack", 120],
]);

const ASSET_PREFIX_COOLDOWNS_MS: Array<[prefix: string, cooldownMs: number]> = [
  ["resource.collect.", 120],
  ["building.construct.", 250],
];

const BURST_PROTECTED_ASSET_IDS = new Set([
  "combat.under_attack",
  "combat.victory",
  "combat.defeat",
  "ui.tx_fail",
  "ui.tx_success",
  "unit.command.attack",
]);

export class AudioPlaybackPolicy {
  private activeByCategory = new Map<AudioCategory, number>();
  private lastAcceptedAtByAsset = new Map<string, number>();
  private acceptedBurstTimeline: Array<Pick<PlaybackRequest, "assetId" | "category" | "nowMs">> = [];

  registerStart(request: PlaybackRequest): PlaybackDecision {
    const cooldownMs = this.resolveCooldownMs(request.assetId);
    const lastAcceptedAt = this.lastAcceptedAtByAsset.get(request.assetId);
    if (lastAcceptedAt !== undefined && request.nowMs - lastAcceptedAt < cooldownMs) {
      return { allowed: false, reason: "cooldown" };
    }

    const activeCount = this.activeByCategory.get(request.category) ?? 0;
    const categoryCap = CATEGORY_CAPS[request.category];
    if (activeCount >= categoryCap) {
      return { allowed: false, reason: "category_cap" };
    }

    this.pruneBurstTimeline(request.nowMs);
    if (this.shouldApplyBurstLimit(request) && this.acceptedBurstTimeline.length >= MAX_BURST_EVENTS) {
      return { allowed: false, reason: "burst_limit" };
    }

    this.lastAcceptedAtByAsset.set(request.assetId, request.nowMs);
    this.activeByCategory.set(request.category, activeCount + 1);

    if (this.shouldApplyBurstLimit(request)) {
      this.acceptedBurstTimeline.push({
        assetId: request.assetId,
        category: request.category,
        nowMs: request.nowMs,
      });
    }

    return { allowed: true };
  }

  registerEnd(release: PlaybackRelease): void {
    const activeCount = this.activeByCategory.get(release.category) ?? 0;
    if (activeCount <= 1) {
      this.activeByCategory.delete(release.category);
      return;
    }

    this.activeByCategory.set(release.category, activeCount - 1);
  }

  getActiveCount(category: AudioCategory): number {
    return this.activeByCategory.get(category) ?? 0;
  }

  private resolveCooldownMs(assetId: string): number {
    const exactMatch = ASSET_COOLDOWNS_MS.get(assetId);
    if (exactMatch !== undefined) {
      return exactMatch;
    }

    const prefixMatch = ASSET_PREFIX_COOLDOWNS_MS.find(([prefix]) => assetId.startsWith(prefix));
    if (prefixMatch) {
      return prefixMatch[1];
    }

    return DEFAULT_REPEAT_INTERVAL_MS;
  }

  private shouldApplyBurstLimit(request: PlaybackRequest): boolean {
    if (request.category === AudioCategory.MUSIC) return false;
    return !BURST_PROTECTED_ASSET_IDS.has(request.assetId);
  }

  private pruneBurstTimeline(nowMs: number): void {
    this.acceptedBurstTimeline = this.acceptedBurstTimeline.filter((entry) => nowMs - entry.nowMs < BURST_WINDOW_MS);
  }
}
