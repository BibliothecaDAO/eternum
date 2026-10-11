export interface Observation {
  done: boolean;
  waiting?: string;
  detail: string;
}
export interface Step {
  name: string;
  payer: string;
  cost: string;
  inspect: () => Promise<Observation>;
  apply: () => Promise<void>;
}
/** Observations are the checkpoints. A local completion flag never substitutes for a remote result. */
export async function runSteps(steps: Step[], apply: boolean, output: (line: string) => void) {
  for (const step of steps) {
    if (apply) output(`Checking ${step.name}.`);
    let before: Observation;
    try {
      before = await step.inspect();
    } catch (error) {
      if (apply) throw error;
      output(`${step.name}: unavailable; read failed; signer ${step.payer}; ${step.cost}`);
      continue;
    }
    output(
      `${step.name}: ${before.done ? "done" : before.waiting ? "waiting" : "needed"}; ${before.detail}; signer ${step.payer}; ${step.cost}`,
    );
    if (before.done || !apply) continue;
    if (before.waiting) {
      output(before.waiting);
      return false;
    }
    await step.apply();
    const after = await step.inspect();
    if (!after.done) {
      output(after.waiting ?? `${step.name} is pending; run the same command again.`);
      return false;
    }
  }
  return true;
}
