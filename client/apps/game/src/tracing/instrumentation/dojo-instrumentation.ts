// import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
// import { withSpan, startSpan, setSpanAttributes, getCurrentTraceId } from "../tracer";
// import { reportSystemError, addBreadcrumb } from "../errors/error-reporter";

// interface DojoSystemCall {
//   contractAddress: string;
//   entrypoint: string;
//   calldata: any[];
// }

// interface DojoTransaction {
//   hash: string;
//   status?: "pending" | "success" | "failed";
//   error?: string;
// }

// export class DojoInstrumentation {
//   private static instance: DojoInstrumentation;
//   private pendingTransactions: Map<string, any> = new Map();

//   private constructor() {}

//   public static getInstance(): DojoInstrumentation {
//     if (!DojoInstrumentation.instance) {
//       DojoInstrumentation.instance = new DojoInstrumentation();
//     }
//     return DojoInstrumentation.instance;
//   }

//   public instrumentSystemCall<T>(
//     systemName: string,
//     method: string,
//     params: any,
//     executeCall: () => Promise<T>,
//   ): Promise<T> {
//     const spanName = `dojo.system.${systemName}.${method}`;

//     // Add breadcrumb for system call
//     addBreadcrumb({
//       type: "api",
//       category: "dojo",
//       message: `Calling ${systemName}.${method}`,
//       data: {
//         system: systemName,
//         method,
//         params: this.sanitizeParams(params),
//       },
//     });

//     return withSpan(
//       spanName,
//       async (span) => {
//         span.setAttributes({
//           "dojo.system": systemName,
//           "dojo.method": method,
//           "dojo.params": JSON.stringify(this.sanitizeParams(params)),
//           "trace.id": getCurrentTraceId(),
//         });

//         const startTime = performance.now();

//         try {
//           const result = await executeCall();
//           const duration = performance.now() - startTime;

//           span.setAttributes({
//             "dojo.duration_ms": duration,
//             "dojo.success": true,
//           });

//           span.setStatus({ code: SpanStatusCode.OK });

//           // Add success breadcrumb
//           addBreadcrumb({
//             type: "api",
//             category: "dojo",
//             message: `${systemName}.${method} completed successfully`,
//             data: {
//               duration,
//               system: systemName,
//               method,
//             },
//           });

//           return result;
//         } catch (error) {
//           const duration = performance.now() - startTime;

//           span.setAttributes({
//             "dojo.duration_ms": duration,
//             "dojo.success": false,
//             "dojo.error": true,
//             "dojo.error_message": (error as Error).message,
//           });

//           span.setStatus({
//             code: SpanStatusCode.ERROR,
//             message: (error as Error).message,
//           });

//           // Report error with context
//           reportSystemError(error as Error, {
//             system: systemName,
//             method,
//             params: this.sanitizeParams(params),
//           });

//           // Add error breadcrumb
//           addBreadcrumb({
//             type: "api",
//             category: "dojo",
//             message: `${systemName}.${method} failed`,
//             data: {
//               duration,
//               error: (error as Error).message,
//               system: systemName,
//               method,
//             },
//           });

//           throw error;
//         }
//       },
//       {
//         kind: SpanKind.CLIENT,
//         attributes: {
//           component: "dojo",
//           "rpc.system": "dojo",
//           "rpc.service": systemName,
//           "rpc.method": method,
//         },
//       },
//     );
//   }

//   public instrumentTransaction<T>(transactionName: string, executeTransaction: () => Promise<T>): Promise<T> {
//     const spanName = `dojo.transaction.${transactionName}`;

//     return withSpan(
//       spanName,
//       async (span) => {
//         span.setAttributes({
//           "dojo.transaction.name": transactionName,
//           "dojo.transaction.timestamp": Date.now(),
//         });

//         const startTime = performance.now();

//         try {
//           const result = await executeTransaction();
//           const duration = performance.now() - startTime;

//           // Extract transaction hash if available
//           const txHash = this.extractTransactionHash(result);
//           if (txHash) {
//             span.setAttributes({
//               "dojo.transaction.hash": txHash,
//             });
//             this.pendingTransactions.set(txHash, {
//               name: transactionName,
//               startTime: Date.now(),
//               spanId: span.spanContext().spanId,
//             });
//           }

//           span.setAttributes({
//             "dojo.transaction.duration_ms": duration,
//             "dojo.transaction.status": "submitted",
//           });

//           span.setStatus({ code: SpanStatusCode.OK });

//           addBreadcrumb({
//             type: "api",
//             category: "dojo",
//             message: `Transaction ${transactionName} submitted`,
//             data: {
//               txHash,
//               duration,
//             },
//           });

//           return result;
//         } catch (error) {
//           const duration = performance.now() - startTime;

//           span.setAttributes({
//             "dojo.transaction.duration_ms": duration,
//             "dojo.transaction.status": "failed",
//             "dojo.transaction.error": (error as Error).message,
//           });

//           span.setStatus({
//             code: SpanStatusCode.ERROR,
//             message: (error as Error).message,
//           });

//           reportSystemError(error as Error, {
//             system: "dojo",
//             method: "transaction",
//             transactionName,
//           });

//           throw error;
//         }
//       },
//       {
//         kind: SpanKind.CLIENT,
//         attributes: {
//           component: "dojo",
//           "transaction.type": "blockchain",
//         },
//       },
//     );
//   }

//   public instrumentQuery<T>(queryName: string, queryParams: any, executeQuery: () => Promise<T>): Promise<T> {
//     const spanName = `dojo.query.${queryName}`;

//     return withSpan(
//       spanName,
//       async (span) => {
//         span.setAttributes({
//           "dojo.query.name": queryName,
//           "dojo.query.params": JSON.stringify(this.sanitizeParams(queryParams)),
//         });

//         const startTime = performance.now();

//         try {
//           const result = await executeQuery();
//           const duration = performance.now() - startTime;

//           span.setAttributes({
//             "dojo.query.duration_ms": duration,
//             "dojo.query.success": true,
//             "dojo.query.result_size": this.getResultSize(result),
//           });

//           span.setStatus({ code: SpanStatusCode.OK });

//           // Only add breadcrumb for slow queries
//           if (duration > 100) {
//             addBreadcrumb({
//               type: "api",
//               category: "dojo",
//               message: `Slow query: ${queryName} (${duration.toFixed(2)}ms)`,
//               data: {
//                 duration,
//                 queryName,
//               },
//             });
//           }

//           return result;
//         } catch (error) {
//           const duration = performance.now() - startTime;

//           span.setAttributes({
//             "dojo.query.duration_ms": duration,
//             "dojo.query.success": false,
//             "dojo.query.error": (error as Error).message,
//           });

//           span.setStatus({
//             code: SpanStatusCode.ERROR,
//             message: (error as Error).message,
//           });

//           reportSystemError(error as Error, {
//             system: "dojo",
//             method: "query",
//             queryName,
//             queryParams: this.sanitizeParams(queryParams),
//           });

//           throw error;
//         }
//       },
//       {
//         kind: SpanKind.CLIENT,
//         attributes: {
//           component: "dojo",
//           "db.system": "dojo",
//           "db.operation": "query",
//         },
//       },
//     );
//   }

//   public recordTransactionConfirmation(txHash: string, status: "success" | "failed", error?: string): void {
//     const txInfo = this.pendingTransactions.get(txHash);
//     if (!txInfo) return;

//     const duration = Date.now() - txInfo.startTime;

//     addBreadcrumb({
//       type: "api",
//       category: "dojo",
//       message: `Transaction ${txInfo.name} ${status}`,
//       data: {
//         txHash,
//         duration,
//         status,
//         error,
//       },
//     });

//     // Create a new span for the confirmation
//     const span = startSpan(`dojo.transaction.confirmation.${txInfo.name}`, {
//       attributes: {
//         "dojo.transaction.hash": txHash,
//         "dojo.transaction.status": status,
//         "dojo.transaction.confirmation_duration_ms": duration,
//         "dojo.transaction.error": error,
//       },
//     });

//     if (status === "success") {
//       span.setStatus({ code: SpanStatusCode.OK });
//     } else {
//       span.setStatus({ code: SpanStatusCode.ERROR, message: error });
//       if (error) {
//         reportSystemError(new Error(error), {
//           system: "dojo",
//           method: "transaction_confirmation",
//           txHash,
//           transactionName: txInfo.name,
//         });
//       }
//     }

//     span.end();
//     this.pendingTransactions.delete(txHash);
//   }

//   private sanitizeParams(params: any): any {
//     if (!params) return null;

//     // Deep clone and sanitize sensitive data
//     const sanitized = JSON.parse(JSON.stringify(params));

//     // Remove or mask sensitive fields
//     const sensitiveFields = ["privateKey", "password", "secret", "token"];

//     const sanitizeObject = (obj: any): any => {
//       if (typeof obj !== "object" || obj === null) return obj;

//       for (const key in obj) {
//         if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
//           obj[key] = "[REDACTED]";
//         } else if (typeof obj[key] === "object") {
//           obj[key] = sanitizeObject(obj[key]);
//         }
//       }

//       return obj;
//     };

//     return sanitizeObject(sanitized);
//   }

//   private extractTransactionHash(result: any): string | null {
//     if (!result) return null;
//     if (typeof result === "string") return result;
//     if (result.transaction_hash) return result.transaction_hash;
//     if (result.hash) return result.hash;
//     if (result.tx_hash) return result.tx_hash;
//     return null;
//   }

//   private getResultSize(result: any): number {
//     if (!result) return 0;
//     if (Array.isArray(result)) return result.length;
//     if (typeof result === "object") return Object.keys(result).length;
//     return 1;
//   }
// }

// // Export singleton instance
// export const dojoInstrumentation = DojoInstrumentation.getInstance();

// // Export convenience functions
// export const instrumentSystemCall = dojoInstrumentation.instrumentSystemCall.bind(dojoInstrumentation);
// export const instrumentTransaction = dojoInstrumentation.instrumentTransaction.bind(dojoInstrumentation);
// export const instrumentQuery = dojoInstrumentation.instrumentQuery.bind(dojoInstrumentation);
