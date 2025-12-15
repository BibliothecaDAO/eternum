import { GUIManager } from "../utils/gui-manager";
import { ensureCosmeticAsset } from "./asset-cache";
import { findCosmeticById, getCosmeticRegistry } from "./registry";
import type { CosmeticRegistryEntry, CosmeticResolutionResult } from "./types";

export interface DebugOverrideParams {
  owner: string;
  kind: "army" | "structure";
  baseType: number | string;
  variant: number | string;
  target: string;
}

interface GlobalOverrideState {
  enabled: boolean;
  armyCosmeticId: string | null;
  armyAttachmentId: string | null;
  structureCosmeticId: string | null;
  structureAttachmentId: string | null;
}

/**
 * Development-only controller for previewing cosmetics regardless of ownership.
 * Provides:
 * - Global override mode (one cosmetic for all armies/structures)
 * - GUI controls in lil-gui
 * - Console API via window.CosmeticsDebug
 */
export class CosmeticDebugController {
  private state: GlobalOverrideState = {
    enabled: false,
    armyCosmeticId: null,
    armyAttachmentId: null,
    structureCosmeticId: null,
    structureAttachmentId: null,
  };

  private guiFolder: ReturnType<typeof GUIManager.addFolder> | null = null;
  private armyOptions: Record<string, string> = {};
  private armyAttachmentOptions: Record<string, string> = {};
  private structureOptions: Record<string, string> = {};
  private structureAttachmentOptions: Record<string, string> = {};

  constructor() {
    if (import.meta.env.DEV) {
      this.buildOptions();
      this.setupGUI();
      this.exposeConsoleAPI();
    }
  }

  private buildOptions(): void {
    const registry = getCosmeticRegistry();

    this.armyOptions = { None: "" };
    this.armyAttachmentOptions = { None: "" };
    this.structureOptions = { None: "" };
    this.structureAttachmentOptions = { None: "" };

    registry.forEach((entry) => {
      if (entry.category === "army-skin") {
        this.armyOptions[entry.id] = entry.id;
      } else if (entry.category === "structure-skin") {
        this.structureOptions[entry.id] = entry.id;
      } else if (entry.category === "attachment") {
        // Check if attachment applies to armies or structures
        const appliesToArmy = entry.appliesTo.some((target) => target.startsWith("army:"));
        const appliesToStructure = entry.appliesTo.some((target) => target.startsWith("structure:"));
        if (appliesToArmy) {
          this.armyAttachmentOptions[entry.id] = entry.id;
        }
        if (appliesToStructure) {
          this.structureAttachmentOptions[entry.id] = entry.id;
        }
      }
    });
  }

  private setupGUI(): void {
    this.guiFolder = GUIManager.addFolder("Cosmetics Debug");
    this.guiFolder.close();

    this.guiFolder.add(this.state, "enabled").name("Override Enabled").onChange(this.onStateChange.bind(this));

    // Army controls
    const armyFolder = this.guiFolder.addFolder("Army");
    armyFolder.add(this.state, "armyCosmeticId", this.armyOptions).name("Skin").onChange(this.onStateChange.bind(this));
    armyFolder
      .add(this.state, "armyAttachmentId", this.armyAttachmentOptions)
      .name("Attachment")
      .onChange(this.onStateChange.bind(this));

    // Structure controls
    const structureFolder = this.guiFolder.addFolder("Structure");
    structureFolder
      .add(this.state, "structureCosmeticId", this.structureOptions)
      .name("Skin")
      .onChange(this.onStateChange.bind(this));
    structureFolder
      .add(this.state, "structureAttachmentId", this.structureAttachmentOptions)
      .name("Attachment")
      .onChange(this.onStateChange.bind(this));

    this.guiFolder.add({ clear: () => this.clearOverrides() }, "clear").name("Clear Overrides");

    this.guiFolder.add({ refresh: () => this.refreshRegistry() }, "refresh").name("Refresh Registry Options");
  }

  private onStateChange(): void {
    const idsToPreload = [
      this.state.armyCosmeticId,
      this.state.armyAttachmentId,
      this.state.structureCosmeticId,
      this.state.structureAttachmentId,
    ].filter(Boolean) as string[];

    idsToPreload.forEach((id) => {
      const entry = findCosmeticById(id);
      if (entry) ensureCosmeticAsset(entry);
    });

    console.debug("[CosmeticsDebug] State changed:", {
      enabled: this.state.enabled,
      armySkin: this.state.armyCosmeticId,
      armyAttachment: this.state.armyAttachmentId,
      structureSkin: this.state.structureCosmeticId,
      structureAttachment: this.state.structureAttachmentId,
    });
  }

  private exposeConsoleAPI(): void {
    const controller = this;

    (window as any).CosmeticsDebug = {
      enable(): void {
        controller.state.enabled = true;
        controller.guiFolder?.controllersRecursive().forEach((c) => c.updateDisplay());
        console.log("[CosmeticsDebug] Overrides enabled");
      },

      disable(): void {
        controller.state.enabled = false;
        controller.guiFolder?.controllersRecursive().forEach((c) => c.updateDisplay());
        console.log("[CosmeticsDebug] Overrides disabled");
      },

      setArmy(cosmeticId: string): void {
        const entry = findCosmeticById(cosmeticId);
        if (!entry) {
          console.error(`[CosmeticsDebug] Cosmetic not found: ${cosmeticId}`);
          return;
        }
        if (entry.category !== "army-skin") {
          console.error(`[CosmeticsDebug] ${cosmeticId} is not an army-skin`);
          return;
        }
        controller.state.armyCosmeticId = cosmeticId;
        controller.state.enabled = true;
        ensureCosmeticAsset(entry);
        controller.guiFolder?.controllersRecursive().forEach((c) => c.updateDisplay());
        console.log(`[CosmeticsDebug] Army cosmetic set to: ${cosmeticId}`);
      },

      setStructure(cosmeticId: string): void {
        const entry = findCosmeticById(cosmeticId);
        if (!entry) {
          console.error(`[CosmeticsDebug] Cosmetic not found: ${cosmeticId}`);
          return;
        }
        if (entry.category !== "structure-skin") {
          console.error(`[CosmeticsDebug] ${cosmeticId} is not a structure-skin`);
          return;
        }
        controller.state.structureCosmeticId = cosmeticId;
        controller.state.enabled = true;
        ensureCosmeticAsset(entry);
        controller.guiFolder?.controllersRecursive().forEach((c) => c.updateDisplay());
        console.log(`[CosmeticsDebug] Structure cosmetic set to: ${cosmeticId}`);
      },

      setArmyAttachment(cosmeticId: string): void {
        const entry = findCosmeticById(cosmeticId);
        if (!entry) {
          console.error(`[CosmeticsDebug] Cosmetic not found: ${cosmeticId}`);
          return;
        }
        if (entry.category !== "attachment") {
          console.error(`[CosmeticsDebug] ${cosmeticId} is not an attachment`);
          return;
        }
        controller.state.armyAttachmentId = cosmeticId;
        controller.state.enabled = true;
        ensureCosmeticAsset(entry);
        controller.guiFolder?.controllersRecursive().forEach((c) => c.updateDisplay());
        console.log(`[CosmeticsDebug] Army attachment set to: ${cosmeticId}`);
      },

      setStructureAttachment(cosmeticId: string): void {
        const entry = findCosmeticById(cosmeticId);
        if (!entry) {
          console.error(`[CosmeticsDebug] Cosmetic not found: ${cosmeticId}`);
          return;
        }
        if (entry.category !== "attachment") {
          console.error(`[CosmeticsDebug] ${cosmeticId} is not an attachment`);
          return;
        }
        controller.state.structureAttachmentId = cosmeticId;
        controller.state.enabled = true;
        ensureCosmeticAsset(entry);
        controller.guiFolder?.controllersRecursive().forEach((c) => c.updateDisplay());
        console.log(`[CosmeticsDebug] Structure attachment set to: ${cosmeticId}`);
      },

      clear(): void {
        controller.clearOverrides();
      },

      listRegistry(): CosmeticRegistryEntry[] {
        return [...getCosmeticRegistry()];
      },

      listArmySkins(): string[] {
        return getCosmeticRegistry()
          .filter((e) => e.category === "army-skin")
          .map((e) => e.id);
      },

      listStructureSkins(): string[] {
        return getCosmeticRegistry()
          .filter((e) => e.category === "structure-skin")
          .map((e) => e.id);
      },

      listAttachments(): string[] {
        return getCosmeticRegistry()
          .filter((e) => e.category === "attachment")
          .map((e) => e.id);
      },

      status(): GlobalOverrideState {
        return { ...controller.state };
      },

      help(): void {
        console.log(`
CosmeticsDebug Console API:
---------------------------
CosmeticsDebug.enable()                  - Enable override mode
CosmeticsDebug.disable()                 - Disable override mode
CosmeticsDebug.setArmy(id)               - Set global army skin override
CosmeticsDebug.setArmyAttachment(id)     - Set global army attachment override
CosmeticsDebug.setStructure(id)          - Set global structure skin override
CosmeticsDebug.setStructureAttachment(id)- Set global structure attachment override
CosmeticsDebug.clear()                   - Clear all overrides
CosmeticsDebug.listRegistry()            - List all registered cosmetics
CosmeticsDebug.listArmySkins()           - List army skin IDs
CosmeticsDebug.listStructureSkins()      - List structure skin IDs
CosmeticsDebug.listAttachments()         - List attachment IDs
CosmeticsDebug.status()                  - Show current override state
CosmeticsDebug.help()                    - Show this help
        `);
      },
    };

    console.log("[CosmeticsDebug] Console API available. Type CosmeticsDebug.help() for usage.");
  }

  clearOverrides(): void {
    this.state.enabled = false;
    this.state.armyCosmeticId = null;
    this.state.armyAttachmentId = null;
    this.state.structureCosmeticId = null;
    this.state.structureAttachmentId = null;
    this.guiFolder?.controllersRecursive().forEach((c) => c.updateDisplay());
    console.log("[CosmeticsDebug] Overrides cleared");
  }

  refreshRegistry(): void {
    this.buildOptions();
    if (this.guiFolder) {
      this.guiFolder.destroy();
      this.setupGUI();
    }
    console.log("[CosmeticsDebug] Registry options refreshed");
  }

  /**
   * Called by resolver to check for debug overrides.
   * Returns a CosmeticResolutionResult if override applies, undefined otherwise.
   */
  resolveOverride(params: DebugOverrideParams): CosmeticResolutionResult | undefined {
    if (!import.meta.env.DEV) return undefined;
    if (!this.state.enabled) return undefined;

    const skinId = params.kind === "army" ? this.state.armyCosmeticId : this.state.structureCosmeticId;
    const attachmentId = params.kind === "army" ? this.state.armyAttachmentId : this.state.structureAttachmentId;

    // Need at least a skin or attachment override to return a result
    if (!skinId && !attachmentId) return undefined;

    const skinEntry = skinId ? findCosmeticById(skinId) : undefined;
    const attachmentEntry = attachmentId ? findCosmeticById(attachmentId) : undefined;

    if (skinEntry) ensureCosmeticAsset(skinEntry);
    if (attachmentEntry) ensureCosmeticAsset(attachmentEntry);

    // Collect attachments from both skin and attachment override
    const attachments = [...(skinEntry?.attachments ?? []), ...(attachmentEntry?.attachments ?? [])];

    return {
      cosmeticId: skinEntry?.id ?? attachmentEntry?.id ?? "debug-override",
      modelKey: skinEntry?.id ?? params.target,
      modelType: (skinEntry?.metadata?.baseModelType as any) ?? undefined,
      attachments,
      registryEntry: skinEntry,
      metadata: skinEntry?.metadata,
    };
  }
}

export const cosmeticDebugController = new CosmeticDebugController();
