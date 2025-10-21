import type { AccountInterface } from "starknet";
import { NotImplementedError } from "../errors";
import { isoNow } from "../utils/time";
import type {
  DeploymentExecutionOptions,
  DeploymentExecutionResult,
  DeploymentExecutor,
  DeploymentFeeEstimate,
  DeploymentPlan,
} from "../types";

class StarknetDeploymentExecutor implements DeploymentExecutor {
  constructor(private readonly _account: AccountInterface) {}

  async execute(plan: DeploymentPlan, options: DeploymentExecutionOptions = {}): Promise<DeploymentExecutionResult> {
    void this._account;
    if (options.dryRun) {
      const started = isoNow();
      return {
        plan,
        receipts: plan.steps.map((step) => ({
          stepId: step.id,
          type: step.type,
          status: "skipped",
          startedAt: started,
          finishedAt: isoNow(),
        })),
      };
    }

    throw new NotImplementedError("Starknet deployment execution");
  }

  async estimate(): Promise<DeploymentFeeEstimate> {
    throw new NotImplementedError("Fee estimation");
  }
}

export const createDeploymentExecutor = (account: AccountInterface): DeploymentExecutor =>
  new StarknetDeploymentExecutor(account);
