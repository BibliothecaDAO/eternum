export interface ContainerLogOptions {
  serverUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoReconnect?: boolean;
  connectionTimeout?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onLog?: (log: string) => void;
}

export class ContainerLogStreamer {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private containerId: string;

  private readonly options: Required<ContainerLogOptions> = {
    serverUrl: "ws://localhost:8000",
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
    autoReconnect: true,
    connectionTimeout: 10000, // 10 seconds
    onConnect: () => {},
    onDisconnect: () => {},
    onError: () => {},
    onLog: () => {},
  };

  constructor(containerId: string, options: ContainerLogOptions = {}) {
    this.containerId = containerId;
    this.options = { ...this.options, ...options };
  }

  /**
   * Connect to the container logs WebSocket stream
   */
  public connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = `${this.options.serverUrl}/containers/${this.containerId}/logs`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
      this.reconnectAttempts = 0;

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.handleError(new Error("Connection timeout"));
          this.disconnect();
        }
      }, this.options.connectionTimeout);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Disconnect from the WebSocket stream
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.options.onDisconnect();
  }

  /**
   * Check if the connection is active
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      this.options.onConnect();
    };

    this.ws.onmessage = (event) => {
      // Handle binary messages
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buffer) => {
          // Docker log format: 8 bytes header + log content
          const data = new Uint8Array(buffer);
          if (data.length >= 8) {
            // Skip the 8-byte header
            const logContent = data.slice(8);
            // Convert to string, handling any invalid UTF-8 sequences
            const decoder = new TextDecoder("utf-8", { fatal: false });
            const logStr = decoder.decode(logContent);
            this.options.onLog(logStr);
          }
        });
      } else {
        // Handle text messages (like error messages)
        this.options.onLog(event.data);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
      this.options.onDisconnect();

      if (
        this.options.autoReconnect &&
        this.reconnectAttempts < this.options.maxReconnectAttempts
      ) {
        this.reconnectAttempts++;
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, this.options.reconnectInterval);
      }
    };

    this.ws.onerror = (event) => {
      this.handleError(new Error("WebSocket error occurred"));
    };
  }

  private handleError(error: Error): void {
    this.isConnecting = false;
    this.options.onError(error);

    if (
      this.options.autoReconnect &&
      this.reconnectAttempts < this.options.maxReconnectAttempts
    ) {
      this.reconnectAttempts++;
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, this.options.reconnectInterval);
    }
  }
}

// Example usage:
/*
const logStreamer = new ContainerLogStreamer('your-container-id', {
  serverUrl: 'ws://your-server:8000',
  onConnect: () => console.log('Connected to container logs'),
  onDisconnect: () => console.log('Disconnected from container logs'),
  onError: (error) => console.error('Error:', error),
  onLog: (log) => console.log('Log:', log),
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectInterval: 5000,
  connectionTimeout: 10000 // 10 seconds
});

// Start streaming logs
logStreamer.connect();

// Stop streaming logs
logStreamer.disconnect();
*/
