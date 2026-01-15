// import * as THREE from "three";
// import { SpanKind } from "@opentelemetry/api";
// import { startSpan, getCurrentTraceId, withSpan } from "../tracer";
// import { reportRenderError, addBreadcrumb } from "../errors/error-reporter";

// interface RenderMetrics {
//   fps: number;
//   frameTime: number;
//   drawCalls: number;
//   triangles: number;
//   points: number;
//   lines: number;
//   geometryMemory: number;
//   textureMemory: number;
//   renderTime: number;
// }

// interface SceneMetrics {
//   objectCount: number;
//   lightCount: number;
//   geometryCount: number;
//   materialCount: number;
//   textureCount: number;
//   memoryUsage: number;
// }

// export class ThreeInstrumentation {
//   private static instance: ThreeInstrumentation;
//   private renderMetrics: Map<string, RenderMetrics[]> = new Map();
//   private sceneMetrics: Map<string, SceneMetrics> = new Map();
//   private frameTimestamps: Map<string, number[]> = new Map();
//   private slowFrameThreshold = 33; // 30 FPS threshold
//   private metricsHistorySize = 60; // Keep last 60 frames

//   private constructor() {}

//   public static getInstance(): ThreeInstrumentation {
//     if (!ThreeInstrumentation.instance) {
//       ThreeInstrumentation.instance = new ThreeInstrumentation();
//     }
//     return ThreeInstrumentation.instance;
//   }

//   public instrumentRenderer(renderer: THREE.WebGLRenderer, rendererName: string = "default"): THREE.WebGLRenderer {
//     // Enable info tracking
//     renderer.info.autoReset = false;

//     const originalRender = renderer.render.bind(renderer);
//     const metrics: RenderMetrics[] = [];
//     const timestamps: number[] = [];

//     this.renderMetrics.set(rendererName, metrics);
//     this.frameTimestamps.set(rendererName, timestamps);

//     renderer.render = (scene: THREE.Scene, camera: THREE.Camera) => {
//       const frameStart = performance.now();
//       const lastFrameTime = timestamps[timestamps.length - 1] || frameStart;
//       const deltaTime = frameStart - lastFrameTime;

//       // Calculate FPS
//       timestamps.push(frameStart);
//       if (timestamps.length > this.metricsHistorySize) {
//         timestamps.shift();
//       }

//       const fps = timestamps.length > 1 ? 1000 / (deltaTime || 16.67) : 60;

//       // Start render span
//       const span = startSpan(`three.${rendererName}.render`, {
//         kind: SpanKind.INTERNAL,
//         attributes: {
//           "three.renderer": rendererName,
//           "three.scene.objects": scene.children.length,
//           "three.camera.type": camera.type,
//           "three.fps": Math.round(fps),
//           "trace.id": getCurrentTraceId(),
//         },
//       });

//       try {
//         // Render the scene
//         originalRender(scene, camera);

//         const frameEnd = performance.now();
//         const renderTime = frameEnd - frameStart;

//         // Collect render info
//         const info = renderer.info;
//         const metric: RenderMetrics = {
//           fps,
//           frameTime: deltaTime,
//           drawCalls: info.render.calls,
//           triangles: info.render.triangles,
//           points: info.render.points,
//           lines: info.render.lines,
//           geometryMemory: info.memory.geometries,
//           textureMemory: info.memory.textures,
//           renderTime,
//         };

//         metrics.push(metric);
//         if (metrics.length > this.metricsHistorySize) {
//           metrics.shift();
//         }

//         // Update span with metrics
//         span.setAttributes({
//           "three.render.time_ms": renderTime,
//           "three.render.draw_calls": metric.drawCalls,
//           "three.render.triangles": metric.triangles,
//           "three.render.fps": Math.round(fps),
//           "three.memory.geometries": metric.geometryMemory,
//           "three.memory.textures": metric.textureMemory,
//         });

//         // Check for performance issues
//         if (renderTime > this.slowFrameThreshold) {
//           span.addEvent("slow_frame", {
//             render_time: renderTime,
//             fps: Math.round(fps),
//             draw_calls: metric.drawCalls,
//           });

//           addBreadcrumb({
//             type: "custom",
//             category: "three",
//             message: `Slow frame detected: ${renderTime.toFixed(2)}ms`,
//             data: {
//               renderer: rendererName,
//               renderTime,
//               fps: Math.round(fps),
//               drawCalls: metric.drawCalls,
//             },
//           });
//         }

//         // Check for FPS drops
//         if (fps < 30 && timestamps.length > 10) {
//           span.addEvent("fps_drop", {
//             fps: Math.round(fps),
//             render_time: renderTime,
//           });
//         }

//         span.setStatus({ code: 0 }); // OK
//         span.end();

//         // Reset info for next frame
//         info.reset();
//       } catch (error) {
//         span.recordException(error as Error);
//         span.setStatus({ code: 1, message: (error as Error).message });
//         span.end();

//         reportRenderError(error as Error, {
//           scene: rendererName,
//           fps: Math.round(fps),
//           memory: renderer.info.memory,
//         });

//         throw error;
//       }
//     };

//     return renderer;
//   }

//   public instrumentScene(scene: THREE.Scene, sceneName: string = "default"): THREE.Scene {
//     const originalAdd = scene.add.bind(scene);
//     const originalRemove = scene.remove.bind(scene);

//     scene.add = (...objects: THREE.Object3D[]) => {
//       const span = startSpan(`three.${sceneName}.add`, {
//         kind: SpanKind.INTERNAL,
//         attributes: {
//           "three.scene": sceneName,
//           "three.objects.count": objects.length,
//           "three.objects.types": objects.map((o) => o.type).join(","),
//         },
//       });

//       try {
//         const result = originalAdd(...objects);
//         this.updateSceneMetrics(scene, sceneName);

//         span.setStatus({ code: 0 });
//         span.end();

//         return result;
//       } catch (error) {
//         span.recordException(error as Error);
//         span.setStatus({ code: 1 });
//         span.end();
//         throw error;
//       }
//     };

//     scene.remove = (...objects: THREE.Object3D[]) => {
//       const span = startSpan(`three.${sceneName}.remove`, {
//         kind: SpanKind.INTERNAL,
//         attributes: {
//           "three.scene": sceneName,
//           "three.objects.count": objects.length,
//           "three.objects.types": objects.map((o) => o.type).join(","),
//         },
//       });

//       try {
//         const result = originalRemove(...objects);
//         this.updateSceneMetrics(scene, sceneName);

//         span.setStatus({ code: 0 });
//         span.end();

//         return result;
//       } catch (error) {
//         span.recordException(error as Error);
//         span.setStatus({ code: 1 });
//         span.end();
//         throw error;
//       }
//     };

//     // Initial metrics
//     this.updateSceneMetrics(scene, sceneName);

//     return scene;
//   }

//   public instrumentLoader<T extends THREE.Loader>(loader: T, loaderName: string = "default"): T {
//     const originalLoad = loader.load?.bind(loader) || loader.loadAsync?.bind(loader);

//     if (loader.load) {
//       loader.load = (
//         url: string,
//         onLoad?: (result: any) => void,
//         onProgress?: (event: ProgressEvent) => void,
//         onError?: (error: Error) => void,
//       ) => {
//         const span = startSpan(`three.loader.${loaderName}`, {
//           kind: SpanKind.INTERNAL,
//           attributes: {
//             "three.loader": loaderName,
//             "three.loader.url": url,
//           },
//         });

//         const startTime = performance.now();

//         addBreadcrumb({
//           type: "custom",
//           category: "three",
//           message: `Loading asset: ${url}`,
//           data: {
//             loader: loaderName,
//             url,
//           },
//         });

//         const wrappedOnLoad = (result: any) => {
//           const loadTime = performance.now() - startTime;

//           span.setAttributes({
//             "three.loader.duration_ms": loadTime,
//             "three.loader.success": true,
//           });
//           span.setStatus({ code: 0 });
//           span.end();

//           addBreadcrumb({
//             type: "custom",
//             category: "three",
//             message: `Asset loaded: ${url}`,
//             data: {
//               loader: loaderName,
//               url,
//               loadTime,
//             },
//           });

//           if (onLoad) onLoad(result);
//         };

//         const wrappedOnError = (error: Error) => {
//           const loadTime = performance.now() - startTime;

//           span.recordException(error);
//           span.setAttributes({
//             "three.loader.duration_ms": loadTime,
//             "three.loader.success": false,
//             "three.loader.error": error.message,
//           });
//           span.setStatus({ code: 1, message: error.message });
//           span.end();

//           reportRenderError(error, {
//             loader: loaderName,
//             url,
//             loadTime,
//           });

//           if (onError) onError(error);
//         };

//         return originalLoad(url, wrappedOnLoad, onProgress, wrappedOnError);
//       };
//     }

//     return loader;
//   }

//   public measureGeometryOperation<T>(operationName: string, geometry: THREE.BufferGeometry, operation: () => T): T {
//     return withSpan(
//       `three.geometry.${operationName}`,
//       (span) => {
//         const vertexCount = geometry.attributes.position?.count || 0;

//         span.setAttributes({
//           "three.geometry.vertices": vertexCount,
//           "three.geometry.attributes": Object.keys(geometry.attributes).length,
//         });

//         const startTime = performance.now();

//         try {
//           const result = operation();
//           const duration = performance.now() - startTime;

//           span.setAttributes({
//             "three.geometry.duration_ms": duration,
//             "three.geometry.success": true,
//           });

//           if (duration > 100) {
//             addBreadcrumb({
//               type: "custom",
//               category: "three",
//               message: `Slow geometry operation: ${operationName}`,
//               data: {
//                 operation: operationName,
//                 duration,
//                 vertexCount,
//               },
//             });
//           }

//           return result;
//         } catch (error) {
//           span.recordException(error as Error);
//           reportRenderError(error as Error, {
//             operation: operationName,
//             vertexCount,
//           });
//           throw error;
//         }
//       },
//       { kind: SpanKind.INTERNAL },
//     );
//   }

//   private updateSceneMetrics(scene: THREE.Scene, sceneName: string): void {
//     let objectCount = 0;
//     let lightCount = 0;
//     const geometries = new Set<THREE.BufferGeometry>();
//     const materials = new Set<THREE.Material>();
//     const textures = new Set<THREE.Texture>();

//     scene.traverse((object) => {
//       objectCount++;

//       if (object instanceof THREE.Light) {
//         lightCount++;
//       }

//       if ("geometry" in object && object.geometry) {
//         geometries.add(object.geometry as THREE.BufferGeometry);
//       }

//       if ("material" in object && object.material) {
//         const mat = object.material;
//         if (Array.isArray(mat)) {
//           mat.forEach((m) => materials.add(m));
//         } else {
//           materials.add(mat as THREE.Material);
//         }

//         // Check for textures
//         const checkTexture = (m: any) => {
//           Object.values(m).forEach((value) => {
//             if (value instanceof THREE.Texture) {
//               textures.add(value);
//             }
//           });
//         };

//         if (Array.isArray(mat)) {
//           mat.forEach(checkTexture);
//         } else {
//           checkTexture(mat);
//         }
//       }
//     });

//     const metrics: SceneMetrics = {
//       objectCount,
//       lightCount,
//       geometryCount: geometries.size,
//       materialCount: materials.size,
//       textureCount: textures.size,
//       memoryUsage: this.estimateMemoryUsage(geometries, textures),
//     };

//     this.sceneMetrics.set(sceneName, metrics);
//   }

//   private estimateMemoryUsage(geometries: Set<THREE.BufferGeometry>, textures: Set<THREE.Texture>): number {
//     let totalMemory = 0;

//     // Estimate geometry memory
//     geometries.forEach((geometry) => {
//       Object.values(geometry.attributes).forEach((attribute: any) => {
//         if (attribute.array) {
//           totalMemory += attribute.array.byteLength;
//         }
//       });

//       if (geometry.index) {
//         totalMemory += geometry.index.array.byteLength;
//       }
//     });

//     // Estimate texture memory
//     textures.forEach((texture) => {
//       if (texture.image) {
//         const img = texture.image;
//         if (img.width && img.height) {
//           // Rough estimate: 4 bytes per pixel (RGBA)
//           totalMemory += img.width * img.height * 4;
//         }
//       }
//     });

//     return totalMemory;
//   }

//   public getAverageMetrics(rendererName: string = "default"): RenderMetrics | null {
//     const metrics = this.renderMetrics.get(rendererName);
//     if (!metrics || metrics.length === 0) return null;

//     const sum = metrics.reduce((acc, m) => ({
//       fps: acc.fps + m.fps,
//       frameTime: acc.frameTime + m.frameTime,
//       drawCalls: acc.drawCalls + m.drawCalls,
//       triangles: acc.triangles + m.triangles,
//       points: acc.points + m.points,
//       lines: acc.lines + m.lines,
//       geometryMemory: acc.geometryMemory + m.geometryMemory,
//       textureMemory: acc.textureMemory + m.textureMemory,
//       renderTime: acc.renderTime + m.renderTime,
//     }));

//     const count = metrics.length;
//     return {
//       fps: sum.fps / count,
//       frameTime: sum.frameTime / count,
//       drawCalls: sum.drawCalls / count,
//       triangles: sum.triangles / count,
//       points: sum.points / count,
//       lines: sum.lines / count,
//       geometryMemory: sum.geometryMemory / count,
//       textureMemory: sum.textureMemory / count,
//       renderTime: sum.renderTime / count,
//     };
//   }

//   public getSceneMetrics(sceneName: string = "default"): SceneMetrics | undefined {
//     return this.sceneMetrics.get(sceneName);
//   }

//   public setSlowFrameThreshold(ms: number): void {
//     this.slowFrameThreshold = ms;
//   }
// }

// // Export singleton instance
// export const threeInstrumentation = ThreeInstrumentation.getInstance();

// // Export convenience functions
// export const instrumentRenderer = threeInstrumentation.instrumentRenderer.bind(threeInstrumentation);
// export const instrumentScene = threeInstrumentation.instrumentScene.bind(threeInstrumentation);
// export const instrumentLoader = threeInstrumentation.instrumentLoader.bind(threeInstrumentation);
// export const measureGeometryOperation = threeInstrumentation.measureGeometryOperation.bind(threeInstrumentation);
