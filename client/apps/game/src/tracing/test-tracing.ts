/**
 * Test utilities for verifying the tracing system is working correctly
 *
 * Usage: Import this file in the browser console or add to window object for testing
 */

import {
  TracingHelpers,
  reportError,
  reportGameError,
  reportNetworkError,
  recordUserAction,
  measureOperation,
  getLatestMetrics,
  withSpan,
  startSpan,
  getCurrentTraceId,
  addBreadcrumb,
} from "./index";

export const TestTracing = {
  // Test basic span creation
  async testBasicSpan(): Promise<void> {
    console.log("🧪 Testing basic span creation...");

    const span = startSpan("test.basic_span", {
      attributes: {
        "test.type": "manual",
        "test.timestamp": Date.now(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    span.setStatus({ code: 0 }); // OK
    span.end();

    console.log("✅ Basic span created with trace ID:", getCurrentTraceId());
  },

  // Test operation measurement
  async testMeasurement(): Promise<void> {
    console.log("🧪 Testing operation measurement...");

    const result = await TracingHelpers.measureGameOperation("test_calculation", async () => {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 250));
      return { value: Math.random() * 100 };
    });

    console.log("✅ Operation measured, result:", result);
  },

  // Test error reporting
  async testErrorReporting(): Promise<void> {
    console.log("🧪 Testing error reporting...");

    try {
      await withSpan("test.error_operation", async () => {
        throw new Error("Test error for tracing system");
      });
    } catch (error) {
      reportError(error, {
        context: {
          test: true,
          operation: "test_error",
        },
      });
      console.log("✅ Error reported successfully");
    }
  },

  // Test game-specific error
  testGameError(): void {
    console.log("🧪 Testing game error reporting...");

    reportGameError(new Error("Invalid army movement"), {
      action: "move_army",
      entityId: "army_123",
      realmId: "realm_456",
      coordinates: { x: 10, y: 20 },
    });

    console.log("✅ Game error reported");
  },

  // Test network error
  testNetworkError(): void {
    console.log("🧪 Testing network error reporting...");

    reportNetworkError(new Error("Connection timeout"), {
      url: "https://api.example.com/data",
      method: "GET",
      status: 0,
      duration: 5000,
    });

    console.log("✅ Network error reported");
  },

  // Test user action recording
  testUserActions(): void {
    console.log("🧪 Testing user action recording...");

    recordUserAction("test_click", {
      button: "trade",
      timestamp: Date.now(),
    });

    recordUserAction("test_navigation", {
      from: "realm_view",
      to: "battle_view",
    });

    console.log("✅ User actions recorded");
  },

  // Test breadcrumbs
  testBreadcrumbs(): void {
    console.log("🧪 Testing breadcrumbs...");

    addBreadcrumb({
      type: "navigation",
      category: "test",
      message: "Navigated to test page",
      data: { page: "test" },
    });

    addBreadcrumb({
      type: "click",
      category: "test",
      message: "Clicked test button",
      data: { buttonId: "test-btn" },
    });

    console.log("✅ Breadcrumbs added");
  },

  // Test performance metrics
  testPerformanceMetrics(): void {
    console.log("🧪 Testing performance metrics...");

    const metrics = getLatestMetrics();
    console.log("Current metrics:", metrics);

    if (metrics) {
      console.log("✅ Performance metrics retrieved:", {
        fps: metrics.fps,
        memory: `${metrics.memory.percent.toFixed(2)}%`,
        latency: `${metrics.network.latency}ms`,
      });
    } else {
      console.log("⚠️ No metrics available yet");
    }
  },

  // Test nested spans
  async testNestedSpans(): Promise<void> {
    console.log("🧪 Testing nested spans...");

    await withSpan("test.parent_operation", async (parentSpan) => {
      parentSpan.setAttribute("test.level", "parent");

      await withSpan("test.child_operation_1", async (childSpan) => {
        childSpan.setAttribute("test.level", "child");
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await withSpan("test.child_operation_2", async (childSpan) => {
        childSpan.setAttribute("test.level", "child");
        await new Promise((resolve) => setTimeout(resolve, 75));
      });
    });

    console.log("✅ Nested spans created");
  },

  // Test batch operations
  async testBatchOperations(): Promise<void> {
    console.log("🧪 Testing batch operations...");

    const operations = Array.from({ length: 5 }, (_, i) => ({
      id: `op_${i}`,
      delay: Math.random() * 100,
    }));

    await withSpan("test.batch_processing", async (span) => {
      span.setAttribute("batch.size", operations.length);

      const results = await Promise.all(
        operations.map((op) =>
          measureOperation(`process_${op.id}`, async () => {
            await new Promise((resolve) => setTimeout(resolve, op.delay));
            return { processed: true, id: op.id };
          }),
        ),
      );

      span.setAttribute("batch.completed", results.length);
      console.log("✅ Batch operations completed:", results);
    });
  },

  // Run all tests
  async runAllTests(): Promise<void> {
    console.log("🚀 Starting comprehensive tracing tests...\n");

    try {
      await this.testBasicSpan();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.testMeasurement();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.testErrorReporting();
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.testGameError();
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.testNetworkError();
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.testUserActions();
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.testBreadcrumbs();
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.testPerformanceMetrics();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.testNestedSpans();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.testBatchOperations();

      console.log("\n✅ All tests completed successfully!");
      console.log("📊 Check your tracing backend to see the generated traces");

      return;
    } catch (error) {
      console.error("❌ Test failed:", error);
      throw error;
    }
  },

  // Generate continuous load for testing
  async generateLoad(durationMs: number = 10000, opsPerSecond: number = 10): Promise<void> {
    console.log(`🔄 Generating load for ${durationMs}ms at ${opsPerSecond} ops/sec...`);

    const interval = 1000 / opsPerSecond;
    const endTime = Date.now() + durationMs;
    let operationCount = 0;

    while (Date.now() < endTime) {
      operationCount++;

      // Randomly choose an operation type
      const operationType = Math.floor(Math.random() * 4);

      switch (operationType) {
        case 0:
          // Simulate game calculation
          await measureOperation("load_test.calculation", async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
          });
          break;

        case 1:
          // Simulate user action
          recordUserAction("load_test.action", {
            type: "click",
            timestamp: Date.now(),
          });
          break;

        case 2:
          // Simulate API call
          await withSpan("load_test.api_call", async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
          });
          break;

        case 3:
          // Simulate error (10% chance)
          if (Math.random() < 0.1) {
            try {
              throw new Error("Load test error");
            } catch (error) {
              reportError(error, { context: { loadTest: true } });
            }
          }
          break;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    console.log(`✅ Load generation completed: ${operationCount} operations`);
  },
};

// Attach to window for easy console access
if (typeof window !== "undefined") {
  (window as any).TestTracing = TestTracing;
  console.log("🧪 TestTracing available on window object");
  console.log("Usage: TestTracing.runAllTests() or TestTracing.generateLoad(5000, 20)");
}
