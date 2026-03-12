export interface TroopRequest {
  id: string;
  type: "troops";
  troopType: "Knight" | "Crossbowman" | "Paladin";
  tier: number;
  amount: number;
  structureId: number;
  priority: "urgent" | "normal";
  status: "pending" | "in_progress" | "done" | "failed";
  createdAt: number;
  completedAt?: number;
  note?: string;
}

export interface ResourceRequest {
  id: string;
  type: "resources";
  resourceType: string;
  amount: number;
  structureId: number;
  priority: "urgent" | "normal";
  status: "pending" | "in_progress" | "done" | "failed";
  createdAt: number;
  completedAt?: number;
  note?: string;
}

export interface PriorityDirective {
  id: string;
  type: "priority";
  instruction: string;
  createdAt: number;
}

export type Directive = TroopRequest | ResourceRequest | PriorityDirective;

export interface ProductionStatus {
  lastTickAt: number;
  currentTask: string;
  realmSummaries: string[];
  errors: string[];
}

let _nextId = 1;
function genId(): string {
  return `dir_${_nextId++}`;
}

export class DirectiveQueue {
  private directives: Directive[] = [];
  private _productionStatus: ProductionStatus = {
    lastTickAt: 0,
    currentTask: "idle",
    realmSummaries: [],
    errors: [],
  };

  addTroopRequest(req: Omit<TroopRequest, "id" | "type" | "status" | "createdAt">): string {
    const id = genId();
    this.directives.push({
      ...req,
      id,
      type: "troops",
      status: "pending",
      createdAt: Date.now(),
    });
    return id;
  }

  addResourceRequest(req: Omit<ResourceRequest, "id" | "type" | "status" | "createdAt">): string {
    const id = genId();
    this.directives.push({
      ...req,
      id,
      type: "resources",
      status: "pending",
      createdAt: Date.now(),
    });
    return id;
  }

  addPriorityDirective(instruction: string): string {
    const id = genId();
    this.directives.push({
      id,
      type: "priority",
      instruction,
      createdAt: Date.now(),
    });
    return id;
  }

  getPending(): Directive[] {
    return this.directives.filter(
      (d) => d.type === "priority" || (d as TroopRequest | ResourceRequest).status === "pending",
    );
  }

  getAll(): Directive[] {
    return [...this.directives];
  }

  markStatus(id: string, status: "in_progress" | "done" | "failed", note?: string): boolean {
    const d = this.directives.find((x) => x.id === id);
    if (!d || d.type === "priority") return false;
    const req = d as TroopRequest | ResourceRequest;
    req.status = status;
    if (note) req.note = note;
    if (status === "done" || status === "failed") req.completedAt = Date.now();
    return true;
  }

  clearCompleted(): number {
    const before = this.directives.length;
    this.directives = this.directives.filter((d) => {
      if (d.type === "priority") return false;
      return (
        (d as TroopRequest | ResourceRequest).status === "pending" ||
        (d as TroopRequest | ResourceRequest).status === "in_progress"
      );
    });
    return before - this.directives.length;
  }

  updateProductionStatus(status: Partial<ProductionStatus>): void {
    Object.assign(this._productionStatus, status, { lastTickAt: Date.now() });
  }

  get productionStatus(): ProductionStatus {
    return { ...this._productionStatus };
  }

  formatForMilitary(): string {
    const lines: string[] = ["## Production Status"];
    const ps = this._productionStatus;
    lines.push(`Current task: ${ps.currentTask}`);
    if (ps.realmSummaries.length > 0) {
      lines.push("Realms:");
      for (const s of ps.realmSummaries) lines.push(`  ${s}`);
    }
    if (ps.errors.length > 0) {
      lines.push("Errors:");
      for (const e of ps.errors) lines.push(`  ${e}`);
    }

    const pending = this.getPending();
    if (pending.length > 0) {
      lines.push(`\nPending requests: ${pending.length}`);
      for (const d of pending) {
        if (d.type === "troops") {
          const t = d as TroopRequest;
          lines.push(
            `  [${t.priority}] ${t.amount} T${t.tier} ${t.troopType} at realm #${t.structureId} — ${t.status}`,
          );
        } else if (d.type === "resources") {
          const r = d as ResourceRequest;
          lines.push(`  [${r.priority}] ${r.amount} ${r.resourceType} at realm #${r.structureId} — ${r.status}`);
        } else {
          lines.push(`  Priority: ${(d as PriorityDirective).instruction}`);
        }
      }
    }

    return lines.join("\n");
  }

  formatForProduction(): string {
    const pending = this.getPending();
    if (pending.length === 0) return "No pending military requests.";

    const lines: string[] = ["## Military Requests (fulfill these)"];
    for (const d of pending) {
      if (d.type === "troops") {
        const t = d as TroopRequest;
        lines.push(
          `[${t.priority.toUpperCase()}] id=${t.id}: Build ${t.amount} T${t.tier} ${t.troopType} at realm #${t.structureId}`,
        );
      } else if (d.type === "resources") {
        const r = d as ResourceRequest;
        lines.push(
          `[${r.priority.toUpperCase()}] id=${r.id}: Provide ${r.amount} ${r.resourceType} at realm #${r.structureId}`,
        );
      } else {
        const p = d as PriorityDirective;
        lines.push(`[PRIORITY] ${p.instruction}`);
      }
    }
    lines.push(
      "\nUse mark_request_status to update request progress. Mark 'done' when fulfilled, 'failed' if impossible.",
    );
    return lines.join("\n");
  }
}
