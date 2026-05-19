type PublicEnvChain = "sepolia" | "mainnet" | "slot" | "slottest" | "local";

type PublicEnvConsistencyInput = {
  VITE_PUBLIC_CHAIN: PublicEnvChain;
  VITE_PUBLIC_SLOT: string;
  VITE_PUBLIC_TORII: string;
};

export const assertPublicEnvConsistency = (env: PublicEnvConsistencyInput): void => {
  const errors = resolvePublicEnvConsistencyErrors(env);
  if (errors.length === 0) {
    return;
  }

  throw new Error(`Invalid public environment configuration:\n${errors.map((error) => `- ${error}`).join("\n")}`);
};

export const resolvePublicEnvConsistencyErrors = (env: PublicEnvConsistencyInput): string[] => {
  if (env.VITE_PUBLIC_CHAIN !== "mainnet") {
    return [];
  }

  return resolveMainnetEnvConsistencyErrors(env);
};

const resolveMainnetEnvConsistencyErrors = (env: PublicEnvConsistencyInput): string[] => {
  const errors: string[] = [];

  if (pointsToSlotDeployment(resolveToriiDeploymentName(env.VITE_PUBLIC_TORII))) {
    errors.push(`VITE_PUBLIC_TORII points to a slot deployment: ${env.VITE_PUBLIC_TORII}`);
  }

  if (pointsToSlotDeployment(env.VITE_PUBLIC_SLOT)) {
    errors.push(`VITE_PUBLIC_SLOT points to a slot deployment: ${env.VITE_PUBLIC_SLOT}`);
  }

  return errors;
};

const resolveToriiDeploymentName = (toriiUrl: string): string => {
  try {
    const pathnameParts = new URL(toriiUrl).pathname.split("/").filter(Boolean);
    const deploymentPrefixIndex = pathnameParts.indexOf("x");
    return deploymentPrefixIndex >= 0 ? (pathnameParts[deploymentPrefixIndex + 1] ?? toriiUrl) : toriiUrl;
  } catch {
    return toriiUrl;
  }
};

const pointsToSlotDeployment = (deploymentName: string): boolean => {
  return /(^|[-_/])slot(test)?($|[-_/])/.test(deploymentName.toLowerCase());
};
