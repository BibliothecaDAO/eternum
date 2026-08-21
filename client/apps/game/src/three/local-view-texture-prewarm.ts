import type { RenderMode } from "./render-profile";
import type { RendererInfoLike } from "./renderer-backend";
import type { Texture } from "three";

const LOCAL_TEXTURE_PREWARM_MIN_DEVICE_MEMORY_GB = 8;
// Keep speculative local-view uploads at one eighth of the former 512 MiB
// allowance and out of renderer sessions that are already texture-heavy.
export const LOCAL_TEXTURE_PREWARM_MAX_ESTIMATED_BYTES = 64 * 1024 * 1024;
export const LOCAL_TEXTURE_PREWARM_MAX_RESIDENT_TEXTURES = 256;
export const LOCAL_TEXTURE_PREWARM_INTERACTION_IDLE_MS = 2_000;
export const LOCAL_TEXTURE_PREWARM_INTERACTION_DEADLINE_MS = 10_000;

type LocalTexturePrewarmSkipReason =
  | "battery_mode"
  | "idle_scheduler_unavailable"
  | "low_device_memory"
  | "memory_budget_exceeded"
  | "mobile_device"
  | "resident_texture_budget_exceeded"
  | "texture_upload_unsupported";

type LocalTexturePrewarmCancelReason =
  | "interaction_deadline_exceeded"
  | "page_hidden"
  | "renderer_destroyed"
  | "scene_changed";

export interface LocalTexturePrewarmReport {
  elapsedMs: number;
  estimatedBytes: number;
  gpuTextureDelta: number;
  reason?: LocalTexturePrewarmCancelReason | LocalTexturePrewarmSkipReason;
  status: "cancelled" | "completed" | "failed" | "skipped";
  textureCount: number;
  uploadMs: number;
}

interface IdleScheduler {
  cancel(handle: number): void;
  schedule(work: () => void): number;
}

interface LocalTexturePrewarmPolicyInput {
  deviceMemoryGb?: number;
  estimatedBytes: number;
  hasIdleScheduler: boolean;
  isMobileDevice: boolean;
  residentTextureCount: number;
  renderMode: RenderMode;
  supportsTextureUpload: boolean;
}

interface CreateLocalViewTexturePrewarmInput {
  deviceMemoryGb?: number;
  getRendererInfo: () => RendererInfoLike;
  hasRecentInteraction: () => boolean;
  isMobileDevice: boolean;
  isOwnerActive: () => boolean;
  isWorldmapActive: () => boolean;
  now?: () => number;
  onError: (error: unknown) => void;
  onReport: (report: LocalTexturePrewarmReport) => void;
  renderMode: RenderMode;
  resolveTextures: () => Promise<readonly Texture[]>;
  scheduler: IdleScheduler | null;
  uploadTexture?: (texture: Texture) => void;
}

export interface LocalViewTexturePrewarmController {
  cancel(reason: LocalTexturePrewarmCancelReason): void;
  start(): void;
}

export function createBrowserIdleScheduler(host: typeof globalThis = globalThis): IdleScheduler | null {
  const idleHost = host as typeof globalThis & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (work: () => void) => number;
  };
  if (typeof idleHost.requestIdleCallback !== "function" || typeof idleHost.cancelIdleCallback !== "function") {
    return null;
  }

  return {
    cancel: (handle) => idleHost.cancelIdleCallback!(handle),
    schedule: (work) => idleHost.requestIdleCallback!(work),
  };
}

export function resolveLocalTexturePrewarmPolicy(
  input: LocalTexturePrewarmPolicyInput,
): { allowed: true } | { allowed: false; reason: LocalTexturePrewarmSkipReason } {
  if (!input.supportsTextureUpload) return { allowed: false, reason: "texture_upload_unsupported" };
  if (!input.hasIdleScheduler) return { allowed: false, reason: "idle_scheduler_unavailable" };
  if (input.isMobileDevice) return { allowed: false, reason: "mobile_device" };
  if (input.renderMode === "battery") return { allowed: false, reason: "battery_mode" };
  if (input.deviceMemoryGb !== undefined && input.deviceMemoryGb < LOCAL_TEXTURE_PREWARM_MIN_DEVICE_MEMORY_GB) {
    return { allowed: false, reason: "low_device_memory" };
  }
  if (input.residentTextureCount >= LOCAL_TEXTURE_PREWARM_MAX_RESIDENT_TEXTURES) {
    return { allowed: false, reason: "resident_texture_budget_exceeded" };
  }
  if (input.estimatedBytes > LOCAL_TEXTURE_PREWARM_MAX_ESTIMATED_BYTES) {
    return { allowed: false, reason: "memory_budget_exceeded" };
  }
  return { allowed: true };
}

export function createLocalViewTexturePrewarm(
  input: CreateLocalViewTexturePrewarmInput,
): LocalViewTexturePrewarmController {
  const now = input.now ?? (() => performance.now());
  let idleHandle: number | null = null;
  let state: "idle" | "loading" | "running" | "terminal" = "idle";
  let textures: Texture[] = [];
  let nextTextureIndex = 0;
  let uploadMs = 0;
  let startedAt: number | null = null;
  let interactionDeadlineAt = 0;
  let textureCountBefore: number | null = null;
  let estimatedBytes = 0;
  const hasFinished = () => state === "terminal";
  const getGpuTextureDelta = () => {
    if (textureCountBefore === null) return 0;
    try {
      return input.getRendererInfo().memory.textures - textureCountBefore;
    } catch {
      return 0;
    }
  };

  const finish = (
    report: Omit<
      LocalTexturePrewarmReport,
      "elapsedMs" | "estimatedBytes" | "gpuTextureDelta" | "textureCount" | "uploadMs"
    >,
  ) => {
    if (hasFinished()) return;
    state = "terminal";
    if (idleHandle !== null) {
      input.scheduler?.cancel(idleHandle);
      idleHandle = null;
    }
    input.onReport({
      ...report,
      elapsedMs: startedAt === null ? 0 : now() - startedAt,
      estimatedBytes,
      gpuTextureDelta: getGpuTextureDelta(),
      textureCount: textures.length,
      uploadMs,
    });
  };

  const scheduleNextTexture = () => {
    if (!input.scheduler || hasFinished()) return;
    idleHandle = input.scheduler.schedule(uploadNextTexture);
  };

  const uploadNextTexture = () => {
    idleHandle = null;
    try {
      if (!input.isOwnerActive()) {
        finish({ status: "cancelled", reason: "renderer_destroyed" });
        return;
      }
      if (!input.isWorldmapActive()) {
        finish({ status: "cancelled", reason: "scene_changed" });
        return;
      }
      if (input.getRendererInfo().memory.textures >= LOCAL_TEXTURE_PREWARM_MAX_RESIDENT_TEXTURES) {
        finish({ status: "cancelled", reason: "resident_texture_budget_exceeded" });
        return;
      }
      if (input.hasRecentInteraction()) {
        if (now() >= interactionDeadlineAt) {
          finish({ status: "cancelled", reason: "interaction_deadline_exceeded" });
          return;
        }
        scheduleNextTexture();
        return;
      }

      const texture = textures[nextTextureIndex];
      if (!texture) {
        finish({ status: "completed" });
        return;
      }

      const uploadStartedAt = now();
      input.uploadTexture!(texture);
      uploadMs += now() - uploadStartedAt;
      nextTextureIndex += 1;
      if (nextTextureIndex >= textures.length) {
        finish({ status: "completed" });
        return;
      }
      scheduleNextTexture();
    } catch (error) {
      input.onError(error);
      finish({ status: "failed" });
    }
  };

  const start = async () => {
    if (state !== "idle") return;
    state = "loading";
    startedAt = now();

    try {
      textureCountBefore = input.getRendererInfo().memory.textures;
      textures = [...new Set(await input.resolveTextures())];
      if (hasFinished()) return;

      estimatedBytes = textures.reduce((total, texture) => total + estimateTextureUploadBytes(texture), 0);
      const policy = resolveLocalTexturePrewarmPolicy({
        deviceMemoryGb: input.deviceMemoryGb,
        estimatedBytes,
        hasIdleScheduler: input.scheduler !== null,
        isMobileDevice: input.isMobileDevice,
        residentTextureCount: input.getRendererInfo().memory.textures,
        renderMode: input.renderMode,
        supportsTextureUpload: input.uploadTexture !== undefined,
      });
      if (!policy.allowed) {
        finish({ status: "skipped", reason: policy.reason });
        return;
      }
      state = "running";
      interactionDeadlineAt = now() + LOCAL_TEXTURE_PREWARM_INTERACTION_DEADLINE_MS;
      if (textures.length === 0) {
        finish({ status: "completed" });
        return;
      }
      scheduleNextTexture();
    } catch (error) {
      if (hasFinished()) return;
      input.onError(error);
      finish({ status: "failed" });
    }
  };

  return {
    cancel(reason) {
      if (hasFinished()) return;
      finish({ status: "cancelled", reason });
    },
    start() {
      void start();
    },
  };
}

export function estimateTextureUploadBytes(texture: Texture): number {
  const image = texture.source?.data ?? texture.image;
  if (Array.isArray(image)) {
    return image.reduce((total, entry) => total + estimateImageUploadBytes(entry, texture.generateMipmaps), 0);
  }
  return estimateImageUploadBytes(image, texture.generateMipmaps);
}

export function formatLocalTexturePrewarmReport(report: LocalTexturePrewarmReport): string {
  const estimatedMb = report.estimatedBytes / (1024 * 1024);
  const reason = report.reason ? ` reason=${report.reason}` : "";
  return `[LocalTexturePrewarm] status=${report.status}${reason} textures=${report.textureCount} upload_ms=${Math.round(
    report.uploadMs,
  )} elapsed_ms=${Math.round(report.elapsedMs)} estimated_mb=${estimatedMb.toFixed(1)} gpu_textures_delta=${
    report.gpuTextureDelta
  }`;
}

function estimateImageUploadBytes(image: unknown, generateMipmaps: boolean): number {
  if (!image || typeof image !== "object") return 0;
  const source = image as {
    data?: { byteLength?: number };
    depth?: number;
    height?: number;
    naturalHeight?: number;
    naturalWidth?: number;
    videoHeight?: number;
    videoWidth?: number;
    width?: number;
  };
  const width = source.width ?? source.videoWidth ?? source.naturalWidth ?? 0;
  const height = source.height ?? source.videoHeight ?? source.naturalHeight ?? 0;
  const depth = source.depth ?? 1;
  const baseBytes = source.data?.byteLength ?? width * height * depth * 4;
  return Math.ceil(baseBytes * (generateMipmaps ? 4 / 3 : 1));
}
