import type { Chain } from "@contracts";

export type FactoryGameMode = "eternum" | "blitz";

export type FactoryRunStatus = "running" | "attention" | "waiting" | "complete";

export type FactoryStepStatus = "pending" | "running" | "succeeded" | "already_done" | "blocked" | "failed";

export type FactoryWatcherKind = "launch" | "continue" | "retry" | "refresh";
export type FactoryPollingStatus = "idle" | "checking" | "live" | "paused";

export type FactoryLaunchStartRule = "next_hour";

export interface FactoryModeDefinition {
  id: FactoryGameMode;
  label: string;
  strapline: string;
  description: string;
  accentClassName: string;
  focusLabel: string;
  stepPrinciples: string[];
}

export interface FactoryEnvironmentOption {
  id: string;
  label: string;
  mode: FactoryGameMode;
  chain: Chain;
}

export interface FactoryLaunchPresetDefaults {
  startRule: FactoryLaunchStartRule;
  durationMinutes?: number;
  devMode: boolean;
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
}

export interface FactoryLaunchPreset {
  id: string;
  mode: FactoryGameMode;
  name: string;
  description: string;
  defaults: FactoryLaunchPresetDefaults;
}

export interface FactoryDurationOption {
  value: number;
  label: string;
}

export interface FactoryRunStep {
  id: string;
  title: string;
  summary: string;
  workflowName: string;
  status: FactoryStepStatus;
  verification: string;
  latestEvent: string;
}

export interface FactoryRun {
  id: string;
  mode: FactoryGameMode;
  name: string;
  environment: string;
  owner: string;
  presetId: string;
  status: FactoryRunStatus;
  summary: string;
  updatedAt: string;
  steps: FactoryRunStep[];
}

export interface FactoryWatcherState {
  kind: FactoryWatcherKind;
  gameName: string;
  title: string;
  detail: string;
  workflowName: string;
  statusLabel: string;
}

export interface FactoryPollingState {
  status: FactoryPollingStatus;
  detail: string;
  lastCheckedAt: number | null;
}
