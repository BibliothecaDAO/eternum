/** Schema-derived classification shared by Herald and the client transport. */
export interface GameSyncModelDefinition {
  name: string;
  scope: "game" | "deployment";
  deletion: "component" | "event-ephemeral";
}
