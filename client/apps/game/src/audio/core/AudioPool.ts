import { AudioAsset } from "../types";

/**
 * Manages a pool of AudioBufferSourceNode instances for a specific audio asset
 * to avoid creating new nodes for every sound playback
 */
export class AudioPool {
  private readonly audioContext: AudioContext;
  private readonly audioBuffer: AudioBuffer;
  private readonly asset: AudioAsset;
  private readonly availableNodes: AudioBufferSourceNode[] = [];
  private readonly activeNodes = new Set<AudioBufferSourceNode>();
  private maxPoolSize: number;

  constructor(audioContext: AudioContext, audioBuffer: AudioBuffer, asset: AudioAsset) {
    this.audioContext = audioContext;
    this.audioBuffer = audioBuffer;
    this.asset = asset;
    this.maxPoolSize = asset.poolSize || 4;

    // Pre-populate pool with initial nodes
    this.warmPool();
  }

  /**
   * Pre-populate the pool with audio nodes
   */
  private warmPool(): void {
    const initialSize = Math.min(this.maxPoolSize, 2); // Start with 2 nodes
    for (let i = 0; i < initialSize; i++) {
      const node = this.createNode();
      this.availableNodes.push(node);
    }
  }

  /**
   * Create a new AudioBufferSourceNode with buffer already set
   */
  private createNode(): AudioBufferSourceNode {
    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = this.audioBuffer;

    // Set up event listener for when sound finishes
    sourceNode.addEventListener("ended", () => {
      this.returnNode(sourceNode);
    });

    return sourceNode;
  }

  /**
   * Get an available audio node from the pool
   */
  getNode(): AudioBufferSourceNode {
    let node = this.availableNodes.pop();

    if (!node) {
      // Pool is empty, create a new node
      node = this.createNode();
    }

    this.activeNodes.add(node);
    return node;
  }

  /**
   * Return a node to the pool when finished playing
   * Since AudioBufferSourceNodes are single-use, we create a fresh one
   */
  private returnNode(node: AudioBufferSourceNode): void {
    this.activeNodes.delete(node);

    // Disconnect the used node
    try {
      node.disconnect();
    } catch (error) {
      // Node may already be disconnected, ignore error
    }

    // Only create a fresh node if we haven't exceeded max pool size
    if (this.availableNodes.length < this.maxPoolSize) {
      // Create a fresh node to replace the used one
      // AudioBufferSourceNodes are single-use, so we must create new ones
      const freshNode = this.createNode();
      this.availableNodes.push(freshNode);
    }
  }

  /**
   * Stop all active nodes and clear the pool
   */
  stopAll(): void {
    // Stop all active nodes
    this.activeNodes.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch (error) {
        // Node may already be stopped, ignore error
      }
    });

    // Disconnect all available nodes
    this.availableNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch (error) {
        // Node may already be disconnected, ignore error
      }
    });

    this.activeNodes.clear();
    this.availableNodes.length = 0;
  }

  /**
   * Get pool statistics for debugging
   */
  getStats(): {
    available: number;
    active: number;
    total: number;
    maxPoolSize: number;
    assetId: string;
  } {
    return {
      available: this.availableNodes.length,
      active: this.activeNodes.size,
      total: this.availableNodes.length + this.activeNodes.size,
      maxPoolSize: this.maxPoolSize,
      assetId: this.asset.id,
    };
  }

  /**
   * Resize the pool (useful for dynamic optimization)
   */
  resizePool(newMaxSize: number): void {
    // Don't allow pool size smaller than currently active nodes
    const minSize = Math.max(newMaxSize, this.activeNodes.size);

    // If shrinking pool, remove excess available nodes
    if (newMaxSize < this.availableNodes.length) {
      const excessNodes = this.availableNodes.splice(newMaxSize);
      excessNodes.forEach((node) => {
        try {
          node.disconnect();
        } catch (error) {
          // Ignore disconnect errors
        }
      });
    }

    this.maxPoolSize = minSize;
  }
}
