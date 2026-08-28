interface TimerQueryExtension {
  GPU_DISJOINT_EXT: number;
  TIME_ELAPSED_EXT: number;
}

interface WebGlRendererLike {
  getContext?(): WebGLRenderingContext;
}

const MAX_PENDING_QUERIES = 8;

/** Asynchronous WebGL2 timer queries avoid stalling the render loop for metrics. */
export class ProceduralCharacterGpuTimer {
  private readonly context?: WebGL2RenderingContext;
  private readonly extension?: TimerQueryExtension;
  private readonly pendingQueries: WebGLQuery[] = [];
  private activeQuery?: WebGLQuery;

  public constructor(renderer: WebGlRendererLike) {
    const context = renderer.getContext?.();
    if (typeof WebGL2RenderingContext === "undefined" || !(context instanceof WebGL2RenderingContext)) return;
    const extension = context.getExtension("EXT_disjoint_timer_query_webgl2") as TimerQueryExtension | null;
    if (!extension) return;
    this.context = context;
    this.extension = extension;
  }

  public get supported(): boolean {
    return Boolean(this.context && this.extension);
  }

  public begin(): void {
    if (!this.context || !this.extension || this.activeQuery || this.pendingQueries.length >= MAX_PENDING_QUERIES)
      return;
    const query = this.context.createQuery();
    if (!query) return;
    this.context.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
    this.activeQuery = query;
  }

  public end(): void {
    if (!this.context || !this.extension || !this.activeQuery) return;
    this.context.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pendingQueries.push(this.activeQuery);
    this.activeQuery = undefined;
  }

  public readAvailable(): number[] {
    if (!this.context || !this.extension) return [];
    const results: number[] = [];
    while (this.pendingQueries.length > 0) {
      const query = this.pendingQueries[0];
      if (!this.context.getQueryParameter(query, this.context.QUERY_RESULT_AVAILABLE)) break;
      this.pendingQueries.shift();
      const disjoint = Boolean(this.context.getParameter(this.extension.GPU_DISJOINT_EXT));
      const elapsedNanoseconds = Number(this.context.getQueryParameter(query, this.context.QUERY_RESULT));
      this.context.deleteQuery(query);
      if (!disjoint && Number.isFinite(elapsedNanoseconds) && elapsedNanoseconds > 0) {
        results.push(elapsedNanoseconds / 1_000_000);
      }
    }
    return results;
  }

  public reset(): void {
    if (!this.context) return;
    this.pendingQueries.splice(0).forEach((query) => this.context?.deleteQuery(query));
  }

  public dispose(): void {
    this.reset();
  }
}
