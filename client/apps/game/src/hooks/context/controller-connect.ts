import type { Connector } from "@starknet-react/core";

type ControllerLikeConnector = Connector & {
  isReady?: () => boolean;
  controller?: {
    probe?: () => Promise<unknown>;
  };
};

const NOT_READY_MESSAGE = "Not ready to connect";

const isControllerConnector = (connector: Connector): connector is ControllerLikeConnector => {
  return connector.id === "controller";
};

const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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
    const message = asErrorMessage(error);
    const shouldRetry = isControllerConnector(connector) && message.includes(NOT_READY_MESSAGE);
    if (!shouldRetry) {
      throw error;
    }
  }

  await warmControllerConnector(connector);
  await connectAsync({ connector });
};
