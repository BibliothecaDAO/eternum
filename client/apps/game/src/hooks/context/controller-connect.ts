import type { Connector } from "@starknet-react/core";

import { extractReadableErrorMessage } from "@/utils/error-message";

type ControllerLikeConnector = Connector & {
  isReady?: () => boolean;
  controller?: {
    probe?: () => Promise<unknown>;
  };
};

const NOT_READY_MESSAGE = "Not ready to connect";
const RECONNECT_FAILURE_MESSAGE = "Unable to reconnect the controller session.";
const CONTROLLER_CONNECT_TIMEOUT_MS = 15_000;

export interface ControllerReconnectState {
  error: string | null;
  status: "idle" | "connecting" | "failed";
}

export const IDLE_CONTROLLER_RECONNECT_STATE: ControllerReconnectState = {
  error: null,
  status: "idle",
};

interface ControllerReconnectAttempt {
  connectAsync: (args: { connector: Connector }) => Promise<void>;
  connectors: Connector[];
}

interface OwnedControllerReconnect {
  retire: () => void;
  start: (attempt: ControllerReconnectAttempt) => boolean;
}

class ControllerConnectTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Controller connection timed out after ${Math.round(timeoutMs / 1_000)} seconds. Check your keychain and try again.`,
    );
    this.name = "ControllerConnectTimeoutError";
  }
}

const isControllerConnector = (connector: Connector): connector is ControllerLikeConnector => {
  return connector.id === "controller";
};

export const pickPrimaryConnector = (connectors: Connector[]): Connector | null => {
  if (connectors.length === 0) {
    return null;
  }

  return connectors.find((connector) => connector.id === "controller") ?? connectors[0];
};

export const warmControllerConnector = async (connector: Connector): Promise<void> => {
  if (!isControllerConnector(connector)) {
    return;
  }

  if (connector.isReady?.()) {
    return;
  }

  await connector.controller?.probe?.();
};

export const connectWithControllerRetry = async (
  connectAsync: (args: { connector: Connector }) => Promise<void>,
  connector: Connector,
): Promise<void> => {
  await warmControllerConnector(connector);

  try {
    await connectAsync({ connector });
    return;
  } catch (error) {
    const message = extractReadableErrorMessage(error, RECONNECT_FAILURE_MESSAGE);
    const shouldRetry = isControllerConnector(connector) && message.includes(NOT_READY_MESSAGE);
    if (!shouldRetry) {
      throw error;
    }
  }

  await warmControllerConnector(connector);
  await connectAsync({ connector });
};

const connectWithControllerDeadline = (
  connect: () => Promise<void>,
  timeoutMs: number = CONTROLLER_CONNECT_TIMEOUT_MS,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new ControllerConnectTimeoutError(timeoutMs));
    }, timeoutMs);

    void connect().then(
      () => {
        globalThis.clearTimeout(timeoutId);
        resolve();
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
};

export const createOwnedControllerReconnect = ({
  onStateChange,
  timeoutMs = CONTROLLER_CONNECT_TIMEOUT_MS,
}: {
  onStateChange: (state: ControllerReconnectState) => void;
  timeoutMs?: number;
}): OwnedControllerReconnect => {
  let activeAttemptToken: number | null = null;
  let nextAttemptToken = 0;

  const retire = () => {
    nextAttemptToken += 1;
    activeAttemptToken = null;
  };

  const settleAttempt = (attemptToken: number, state: ControllerReconnectState) => {
    if (activeAttemptToken !== attemptToken) {
      return;
    }

    activeAttemptToken = null;
    onStateChange(state);
  };

  const start = ({ connectAsync, connectors }: ControllerReconnectAttempt): boolean => {
    if (activeAttemptToken !== null) {
      return false;
    }

    const attemptToken = nextAttemptToken + 1;
    nextAttemptToken = attemptToken;
    activeAttemptToken = attemptToken;

    const connector = pickPrimaryConnector(connectors);
    if (!connector) {
      settleAttempt(attemptToken, {
        error: "No compatible wallet connector is available.",
        status: "failed",
      });
      return true;
    }

    onStateChange({ error: null, status: "connecting" });

    // Cartridge exposes no abort handle. Retiring advances ownership so this
    // promise may finish, but its late result cannot update the current state.
    void connectWithControllerDeadline(() => connectWithControllerRetry(connectAsync, connector), timeoutMs).then(
      () => settleAttempt(attemptToken, IDLE_CONTROLLER_RECONNECT_STATE),
      (error: unknown) =>
        settleAttempt(attemptToken, {
          error: extractReadableErrorMessage(error, RECONNECT_FAILURE_MESSAGE),
          status: "failed",
        }),
    );
    return true;
  };

  return { retire, start };
};
