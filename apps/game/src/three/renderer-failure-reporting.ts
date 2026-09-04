import * as Sentry from "@sentry/react";
import { formatReadableErrorForConsole } from "@/utils/error-message";
import { appendConsoleFields } from "@/utils/console-message";

import type { RendererActiveMode, RendererDeviceLostEvent } from "./renderer-backend-v2";
import { RENDERER_FRAME_FAILURE_REPORT_INTERVAL } from "./renderer-animation-runtime";

interface RendererFailureContext {
  activeMode: RendererActiveMode | null;
  repeatCount: number;
  sceneName?: string;
}

export function reportRendererFrameFailure(error: unknown, context: RendererFailureContext): void {
  const normalizedError = normalizeRendererError(error, "Renderer frame failed");
  const rendererMode = context.activeMode ?? "unknown";
  const sceneName = context.sceneName ?? "unknown";

  console.error(
    appendConsoleFields("[RendererFailure]", {
      kind: "frame_error",
      renderer_mode: rendererMode,
      scene: sceneName,
      repeat_count: context.repeatCount,
      report_interval: RENDERER_FRAME_FAILURE_REPORT_INTERVAL,
      error: formatRendererErrorForLog(normalizedError),
    }),
  );
  captureRendererFailure(normalizedError, {
    fingerprint: ["renderer-frame-error", rendererMode, normalizedError.name, normalizedError.message],
    tags: {
      "renderer.backend": rendererMode,
      "renderer.failure_kind": "frame_error",
      "renderer.scene": sceneName,
    },
  });
}

export function reportRendererDeviceLoss(event: RendererDeviceLostEvent, input: { recoveryAttempted: boolean }): void {
  const recoveryAttempted = input.recoveryAttempted ? "yes" : "no";
  const message = event.message?.trim() || "Renderer device lost";
  const error = new Error(message);

  console.error(
    appendConsoleFields("[RendererFailure]", {
      kind: "device_lost",
      renderer_mode: event.activeMode,
      recovery_attempted: recoveryAttempted,
      error: formatRendererErrorForLog(error),
    }),
  );
  captureRendererFailure(error, {
    fingerprint: ["renderer-device-lost", event.activeMode],
    tags: {
      "renderer.backend": event.activeMode,
      "renderer.failure_kind": "device_lost",
      "renderer.recovery_attempted": recoveryAttempted,
    },
  });
}

export function reportRendererRecoveryFailure(error: unknown, lostMode: RendererActiveMode): void {
  const normalizedError = normalizeRendererError(error, "Renderer device-loss fallback failed");

  console.error(
    appendConsoleFields("[RendererFailure]", {
      kind: "recovery_failed",
      renderer_mode: lostMode,
      error: formatRendererErrorForLog(normalizedError),
    }),
  );
  captureRendererFailure(normalizedError, {
    fingerprint: ["renderer-recovery-failed", lostMode, normalizedError.name, normalizedError.message],
    tags: {
      "renderer.backend": lostMode,
      "renderer.failure_kind": "recovery_failed",
    },
  });
}

function normalizeRendererError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  const message = formatReadableErrorForConsole(error).trim();
  return new Error(message || fallbackMessage);
}

function formatRendererErrorForLog(error: Error): string {
  return formatReadableErrorForConsole(error).replace(/\s+/g, " ").trim();
}

function captureRendererFailure(
  error: Error,
  context: {
    fingerprint: string[];
    tags: Record<string, string>;
  },
): void {
  try {
    Sentry.captureException(error, {
      fingerprint: context.fingerprint,
      tags: context.tags,
    });
  } catch (captureError) {
    console.error(
      appendConsoleFields("[RendererFailure]", {
        kind: "sentry_capture_failed",
        error: formatReadableErrorForConsole(captureError),
      }),
    );
  }
}
