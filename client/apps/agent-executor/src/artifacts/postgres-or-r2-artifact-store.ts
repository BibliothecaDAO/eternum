import { FileSystemAgentArtifactStore } from "@bibliothecadao/agent-runtime";

export function createExecutorArtifactStore() {
  return new FileSystemAgentArtifactStore(process.env.AGENT_ARTIFACTS_DIR ?? ".agent-artifacts");
}
