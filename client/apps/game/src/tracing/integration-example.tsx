/**
 * Integration Examples for the Eternum Tracing System
 * 
 * This file demonstrates how to integrate the tracing system into various parts of the game.
 */

import React, { useEffect } from 'react';
import { ToriiClient } from '@dojoengine/torii-client';
import { Socket } from 'socket.io-client';
import * as THREE from 'three';

// Import tracing utilities
import {
  initializeTracing,
  TracingHelpers,
  instrumentSystemCall,
  instrumentToriiQuery,
  instrumentSocket,
  instrumentRenderer,
  withTrace,
  useComponentTrace,
  useInteractionTrace,
  reportGameError,
  setUserId,
  setRealmId,
  recordUserAction,
} from './index';

// ============================================
// 1. INITIALIZE TRACING ON APP START
// ============================================

export function initializeAppTracing(userId?: string, realmId?: string) {
  // Initialize the tracing system
  initializeTracing({
    userId,
    realmId,
    enableMetricsCollection: true,
    metricsInterval: 1000, // Collect metrics every second
  });
}

// ============================================
// 2. INSTRUMENT DOJO SYSTEM CALLS
// ============================================

export async function makeTracedDojoCall(
  systemName: string,
  method: string,
  params: any
): Promise<any> {
  return instrumentSystemCall(
    systemName,
    method,
    params,
    async () => {
      // Your actual Dojo system call here
      // const result = await dojoClient.call(systemName, method, params);
      // return result;
      return Promise.resolve({ success: true });
    }
  );
}

// Example: Trading system call
export async function executeTrade(fromRealm: string, toRealm: string, resource: string, amount: number) {
  try {
    const result = await instrumentSystemCall(
      'trading_system',
      'execute_trade',
      { fromRealm, toRealm, resource, amount },
      async () => {
        // Actual trade execution
        // return await tradingSystem.executeTrade(fromRealm, toRealm, resource, amount);
        return Promise.resolve({ transactionHash: '0x123' });
      }
    );
    
    recordUserAction('trade_executed', { resource, amount });
    return result;
  } catch (error) {
    reportGameError(error as Error, {
      action: 'execute_trade',
      fromRealm,
      toRealm,
      resource,
      amount,
    });
    throw error;
  }
}

// ============================================
// 3. INSTRUMENT TORII QUERIES
// ============================================

export async function fetchRealmData(
  client: ToriiClient,
  realmId: string
): Promise<any> {
  return instrumentToriiQuery(
    'fetch_realm_data',
    {
      client,
      models: ['Realm', 'Resource', 'Army'],
      limit: 100,
    },
    async () => {
      // Actual Torii query
      // return await client.getEntities({ realm_id: realmId });
      return Promise.resolve({ entities: [] });
    }
  );
}

// ============================================
// 4. INSTRUMENT WEBSOCKET CONNECTIONS
// ============================================

export function setupTracedWebSocket(socket: Socket): Socket {
  // Instrument the socket
  const instrumentedSocket = instrumentSocket(socket, 'game-socket');

  // Add specific event handlers with tracing
  instrumentedSocket.on('game_update', TracingHelpers.tracedHandler('game_update', (data) => {
    console.log('Game update received:', data);
    recordUserAction('received_game_update', { updateType: data.type });
  }));

  instrumentedSocket.on('error', (error) => {
    reportGameError(new Error(error), {
      action: 'websocket_error',
      socketId: socket.id,
    });
  });

  return instrumentedSocket;
}

// ============================================
// 5. INSTRUMENT REACT COMPONENTS
// ============================================

// Using HOC for class components
@withTrace
class TracedGameBoard extends React.Component {
  render() {
    return <div>Game Board</div>;
  }
}

// Using hook for functional components
export const TracedRealmView: React.FC<{ realmId: string }> = ({ realmId }) => {
  // Track component lifecycle
  useComponentTrace('RealmView');
  
  // Track user interactions
  const trackClick = useInteractionTrace('realm_action_click');

  useEffect(() => {
    setRealmId(realmId);
    recordUserAction('viewed_realm', { realmId });
  }, [realmId]);

  return (
    <div>
      <h2>Realm {realmId}</h2>
      <button onClick={trackClick}>Perform Action</button>
    </div>
  );
};

// Wrap existing components
export const TracedArmyManager = withTrace(
  ({ armyId }: { armyId: string }) => {
    const moveArmy = TracingHelpers.tracedHandler('move_army', async (destination) => {
      await makeTracedDojoCall('army_system', 'move', { armyId, destination });
    });

    return (
      <div>
        <button onClick={() => moveArmy({ x: 10, y: 20 })}>
          Move Army
        </button>
      </div>
    );
  },
  'ArmyManager'
);

// ============================================
// 6. INSTRUMENT THREE.JS RENDERING
// ============================================

export function setupTracedRenderer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene
): void {
  // Instrument the renderer
  instrumentRenderer(renderer, 'main-renderer');

  // Track scene updates
  const originalAdd = scene.add.bind(scene);
  scene.add = (...objects: THREE.Object3D[]) => {
    recordUserAction('scene_objects_added', {
      count: objects.length,
      types: objects.map(o => o.type),
    });
    return originalAdd(...objects);
  };
}

// ============================================
// 7. MEASURE GAME OPERATIONS
// ============================================

export async function calculateBattleOutcome(
  attacker: any,
  defender: any
): Promise<any> {
  return TracingHelpers.measureGameOperation(
    'battle_calculation',
    async () => {
      // Complex battle simulation
      const startTime = performance.now();
      
      // Simulate calculation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = {
        winner: Math.random() > 0.5 ? 'attacker' : 'defender',
        casualties: Math.floor(Math.random() * 100),
      };

      const duration = performance.now() - startTime;
      TracingHelpers.recordMetric('battleSimulationTime', duration);

      return result;
    }
  );
}

// ============================================
// 8. ERROR HANDLING WITH CONTEXT
// ============================================

export function handleGameError(error: Error, context: any): void {
  // Report with full context
  reportGameError(error, {
    action: context.action,
    entityId: context.entityId,
    realmId: context.realmId,
    coordinates: context.coordinates,
    gameState: context.gameState,
  });

  // Add breadcrumb for debugging
  TracingHelpers.addBreadcrumb(
    `Error in ${context.action}`,
    {
      error: error.message,
      ...context,
    }
  );
}

// ============================================
// 9. PERFORMANCE MONITORING
// ============================================

export function monitorGamePerformance(): void {
  // Set custom thresholds
  const { metricsCollector } = require('./performance/metrics-collector');
  
  metricsCollector.setThreshold('fps', 45, 30);
  metricsCollector.setThreshold('memory', 70, 85);
  
  // React to performance issues
  metricsCollector.onAlert('performance-monitor', (metric, value, threshold) => {
    if (metric === 'fps' && value < 30) {
      console.warn('Low FPS detected, reducing quality settings');
      // Reduce graphics quality
      recordUserAction('auto_quality_reduction', { reason: 'low_fps', fps: value });
    }
    
    if (metric === 'memory' && value > 85) {
      console.warn('High memory usage, clearing caches');
      // Clear unnecessary caches
      recordUserAction('auto_cache_clear', { reason: 'high_memory', usage: value });
    }
  });
}

// ============================================
// 10. BATCH OPERATIONS TRACING
// ============================================

export async function batchUpdateEntities(
  entities: Array<{ id: string; updates: any }>
): Promise<void> {
  return TracingHelpers.measureGameOperation(
    'batch_entity_update',
    async () => {
      // Track individual operations within the batch
      const results = await Promise.all(
        entities.map((entity, index) =>
          instrumentSystemCall(
            'entity_system',
            'update',
            entity,
            async () => {
              // Update entity
              return Promise.resolve({ success: true });
            }
          )
        )
      );

      TracingHelpers.recordMetric('batchUpdateSize', entities.length);
      return results;
    }
  );
}

// ============================================
// 11. USER JOURNEY TRACKING
// ============================================

export class UserJourneyTracker {
  private journeySteps: string[] = [];

  trackStep(step: string, data?: any): void {
    this.journeySteps.push(step);
    recordUserAction(`journey_${step}`, {
      ...data,
      stepNumber: this.journeySteps.length,
      previousStep: this.journeySteps[this.journeySteps.length - 2],
    });

    TracingHelpers.addBreadcrumb(
      `User journey: ${step}`,
      {
        journey: this.journeySteps,
        ...data,
      }
    );
  }

  completeJourney(outcome: 'success' | 'abandon' | 'error'): void {
    recordUserAction('journey_complete', {
      outcome,
      steps: this.journeySteps,
      duration: Date.now(), // Would calculate from start
    });
  }
}

// Usage example
const journeyTracker = new UserJourneyTracker();
journeyTracker.trackStep('login');
journeyTracker.trackStep('select_realm', { realmId: '0x123' });
journeyTracker.trackStep('first_action', { actionType: 'build' });
journeyTracker.completeJourney('success');