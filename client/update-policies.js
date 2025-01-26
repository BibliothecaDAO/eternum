import { readFileSync, writeFileSync } from "fs";
import ts from "typescript";

const MANIFEST_PATHS = {
  local: "../contracts/game/manifest_local.json",
  slot: "../contracts/game/manifest_slot.json",
  sepolia: "../contracts/game/manifest_sepolia.json",
  mainnet: "../contracts/game/manifest_mainnet.json",
};

const policiesPath = "apps/game/src/hooks/context/policies.ts";

function updatePoliciesWithManifestAddresses(network, policiesPath) {
  if (!Object.keys(MANIFEST_PATHS).includes(network)) {
    throw new Error(`Invalid network. Must be one of: ${Object.keys(MANIFEST_PATHS).join(", ")}`);
  }

  const manifestPath = MANIFEST_PATHS[network];

  const manifestData = JSON.parse(readFileSync(manifestPath, "utf8"));
  const fileContent = readFileSync(policiesPath, "utf8");

  const sourceFile = ts.createSourceFile(policiesPath, fileContent, ts.ScriptTarget.Latest, true);

  function findAddressForSystem(systemName) {
    for (const contract of manifestData.contracts) {
      if (contract.systems && contract.systems.includes(systemName)) {
        return contract.address;
      }
    }
    return null;
  }

  let updatedContent = fileContent;

  function updateAddressesInPolicies(node) {
    if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((prop) => {
        if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.name)) {
          const currentAddress = prop.name.getText().replace(/"/g, "");

          if (ts.isObjectLiteralExpression(prop.initializer)) {
            const methodsProp = prop.initializer.properties.find(
              (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.getText() === "methods",
            );

            if (methodsProp && ts.isPropertyAssignment(methodsProp)) {
              if (ts.isArrayLiteralExpression(methodsProp.initializer)) {
                // Find methods that are not 'dojo_name', 'world_dispatcher', or 'create'
                const interestingMethods = methodsProp.initializer.elements.filter(
                  (elem) => ts.isObjectLiteralExpression(elem) && hasInterestingEntrypoint(elem),
                );

                interestingMethods.forEach((method) => {
                  const nameProperty = method.properties.find(
                    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.getText() === "name",
                  );

                  if (nameProperty) {
                    const systemName = nameProperty.initializer.getText().replace(/"/g, "");
                    const newAddress = findAddressForSystem(systemName);

                    if (newAddress && newAddress !== currentAddress) {
                      console.log(`Updating address for system ${systemName}:`);
                      console.log(`  Old address: ${currentAddress}`);
                      console.log(`  New address: ${newAddress}`);

                      // Replace the old address with the new one
                      updatedContent = updatedContent.replace(`"${currentAddress}":`, `"${newAddress}":`);
                    }
                  }
                });
              }
            }
          }
        }
      });
    }

    ts.forEachChild(node, updateAddressesInPolicies);
  }

  function hasInterestingEntrypoint(methodNode) {
    const nameProperty = methodNode.properties.find(
      (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.getText() === "name",
    );

    return (
      nameProperty &&
      ts.isStringLiteral(nameProperty.initializer) &&
      !["dojo_name", "world_dispatcher", "create"].includes(nameProperty.initializer.getText().replace(/"/g, ""))
    );
  }

  updateAddressesInPolicies(sourceFile);

  writeFileSync(policiesPath, updatedContent);
  console.log(`Policies file updated successfully for ${network} network.`);
}

// If run directly, default to sepolia
if (import.meta.url === `file://${process.argv[1]}`) {
  const network = process.argv[2];
  updatePoliciesWithManifestAddresses(network, policiesPath);
}
