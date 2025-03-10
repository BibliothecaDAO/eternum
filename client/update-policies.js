import * as fs from "fs";
import { readFileSync, writeFileSync } from "fs";

const MANIFEST_PATHS = {
  local: "../contracts/game/manifest_local.json",
  slot: "../contracts/game/manifest_slot.json",
  sepolia: "../contracts/game/manifest_sepolia.json",
  mainnet: "../contracts/game/manifest_mainnet.json",
};

const policiesPath = "apps/game/src/hooks/context/policies.ts";

// VRF contract and method that needs to be hardcoded
const VRF_CONTRACT = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
const VRF_METHOD = {
  name: "VRF",
  description: "Verifiable Random Function",
  entrypoint: "request_random",
};

function updatePoliciesWithManifestMethods(network, policiesPath) {
  if (!Object.keys(MANIFEST_PATHS).includes(network)) {
    throw new Error(`Invalid network. Must be one of: ${Object.keys(MANIFEST_PATHS).join(", ")}`);
  }

  const manifestPath = MANIFEST_PATHS[network];
  console.log(`Using manifest: ${manifestPath}`);

  // Read the manifest data
  const manifestData = JSON.parse(readFileSync(manifestPath, "utf8"));

  // Read the existing policies file
  const existingPoliciesContent = readFileSync(policiesPath, "utf8");

  // Parse the existing policies to extract the current contracts and methods
  const existingPolicies = parseExistingPolicies(existingPoliciesContent);

  // Extract all contracts with their addresses from the manifest
  const contractsWithAddresses = manifestData.contracts.map((contract) => ({
    address: contract.address,
    systems: contract.systems || [],
    abi: contract.abi || [],
  }));

  // Find all external methods in the manifest
  const externalMethods = findAllExternalMethods(manifestData);

  // Map external methods to contract addresses
  const manifestContractMethods = mapMethodsToContracts(externalMethods, contractsWithAddresses);

  // Ensure VRF is included
  if (!manifestContractMethods[VRF_CONTRACT]) {
    manifestContractMethods[VRF_CONTRACT] = [];
  }

  // Check if VRF method already exists
  const vrfExists = manifestContractMethods[VRF_CONTRACT].some((method) => method.name === VRF_METHOD.name);
  if (!vrfExists) {
    manifestContractMethods[VRF_CONTRACT].push(VRF_METHOD);
  }

  // Merge the manifest methods with the existing policies
  const updatedPolicies = mergeWithExistingPolicies(existingPolicies, manifestContractMethods);

  // Generate the updated policies file content
  const updatedContent = generateUpdatedPoliciesContent(updatedPolicies);

  // Write the updated policies file
  writeFileSync(policiesPath, updatedContent);
  console.log(`Policies file updated successfully for ${network} network.`);
}

// Function to parse the existing policies file and extract the contracts and methods
function parseExistingPolicies(content) {
  const policies = { contracts: {} };

  try {
    // Extract the contracts section using regex
    const contractsMatch = content.match(/contracts:\s*{([^}]*)}/s);
    if (contractsMatch && contractsMatch[1]) {
      const contractsSection = contractsMatch[1];

      // Find all contract addresses
      const contractAddressRegex = /"(0x[a-fA-F0-9]+)":\s*{/g;
      let match;

      while ((match = contractAddressRegex.exec(contractsSection)) !== null) {
        const contractAddress = match[1];
        const contractStart = match.index;

        // Find the end of this contract's section
        let bracketCount = 1;
        let endIndex = contractStart + match[0].length;

        while (bracketCount > 0 && endIndex < contractsSection.length) {
          const char = contractsSection[endIndex];
          if (char === "{") {
            bracketCount++;
          } else if (char === "}") {
            bracketCount--;
          }
          endIndex++;
        }

        // Extract the contract's methods
        const contractContent = contractsSection.substring(contractStart + match[0].length, endIndex - 1);
        const methods = extractMethods(contractContent);

        policies.contracts[contractAddress] = { methods };
      }
    }
  } catch (error) {
    console.warn("Error parsing existing policies:", error);
  }

  return policies;
}

// Function to extract methods from a contract section
function extractMethods(contractContent) {
  const methods = [];

  try {
    // Find the methods section
    const methodsMatch = contractContent.match(/methods:\s*\[([\s\S]*)\]/s);
    if (methodsMatch && methodsMatch[1]) {
      const methodsSection = methodsMatch[1];

      // Split by method objects
      const methodRegex = /{([^}]*)}/g;
      let methodMatch;

      while ((methodMatch = methodRegex.exec(methodsSection)) !== null) {
        const methodContent = methodMatch[1];

        // Extract method properties
        const nameMatch = methodContent.match(/name:\s*"([^"]*)"/);
        const entrypointMatch = methodContent.match(/entrypoint:\s*"([^"]*)"/);
        const descriptionMatch = methodContent.match(/description:\s*"([^"]*)"/);

        if (nameMatch && entrypointMatch) {
          const method = {
            name: nameMatch[1],
            entrypoint: entrypointMatch[1],
          };

          if (descriptionMatch) {
            method.description = descriptionMatch[1];
          }

          methods.push(method);
        }
      }
    }
  } catch (error) {
    console.warn("Error extracting methods:", error);
  }

  return methods;
}

function findAllExternalMethods(manifestData) {
  const externalMethods = [];

  // Helper function to recursively search for external methods
  function searchForExternalMethods(obj, parentName = null) {
    if (!obj || typeof obj !== "object") return;

    // Check if this is a function with external state mutability
    if (obj.type === "function" && obj.state_mutability === "external") {
      externalMethods.push({
        name: obj.name,
        entrypoint: obj.name,
        interfaceName: parentName,
      });
    }

    // If this is an interface, remember its name for children
    const currentParentName = obj.type === "interface" ? obj.name : parentName;

    // Recursively search in arrays
    if (Array.isArray(obj)) {
      obj.forEach((item) => searchForExternalMethods(item, currentParentName));
    }
    // Recursively search in object properties
    else {
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key] === "object") {
          searchForExternalMethods(obj[key], currentParentName);
        }
      }
    }
  }

  searchForExternalMethods(manifestData);
  return externalMethods;
}

function mapMethodsToContracts(externalMethods, contractsWithAddresses) {
  const contractMethods = {};

  // Initialize with empty methods arrays for all contracts
  contractsWithAddresses.forEach((contract) => {
    contractMethods[contract.address] = [];
  });

  // Map interface implementations to contracts
  const interfaceToContract = {};
  contractsWithAddresses.forEach((contract) => {
    if (contract.abi) {
      contract.abi.forEach((item) => {
        if (item.type === "impl" && item.interface_name) {
          interfaceToContract[item.interface_name] = contract.address;
        }
      });
    }
  });

  // Map methods to contracts based on interface implementations
  externalMethods.forEach((method) => {
    if (method.interfaceName && interfaceToContract[method.interfaceName]) {
      const contractAddress = interfaceToContract[method.interfaceName];

      // Check if method already exists to avoid duplicates
      const methodExists = contractMethods[contractAddress].some(
        (existingMethod) => existingMethod.entrypoint === method.entrypoint,
      );

      if (!methodExists) {
        contractMethods[contractAddress].push({
          name: method.name,
          entrypoint: method.entrypoint,
        });
      }
    }
  });

  // Add system methods from contract.systems
  contractsWithAddresses.forEach((contract) => {
    if (contract.systems && contract.systems.length > 0) {
      contract.systems.forEach((systemName) => {
        // Skip 'upgrade' system as it's not typically needed in policies
        if (systemName !== "upgrade") {
          // Check if method already exists to avoid duplicates
          const methodExists = contractMethods[contract.address].some(
            (existingMethod) => existingMethod.entrypoint === systemName,
          );

          if (!methodExists) {
            contractMethods[contract.address].push({
              name: systemName,
              entrypoint: systemName,
            });
          }
        }
      });
    }
  });

  // Add standard methods that should be in all contracts
  contractsWithAddresses.forEach((contract) => {
    // Add dojo_name to all contracts
    const dojoNameExists = contractMethods[contract.address].some((method) => method.entrypoint === "dojo_name");

    if (!dojoNameExists) {
      contractMethods[contract.address].push({
        name: "dojo_name",
        entrypoint: "dojo_name",
      });
    }

    // Add world_dispatcher to all contracts
    const worldDispatcherExists = contractMethods[contract.address].some(
      (method) => method.entrypoint === "world_dispatcher",
    );

    if (!worldDispatcherExists) {
      contractMethods[contract.address].push({
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      });
    }
  });

  // Remove empty contracts
  Object.keys(contractMethods).forEach((address) => {
    if (contractMethods[address].length === 0) {
      delete contractMethods[address];
    }
  });

  return contractMethods;
}

// Function to merge the manifest methods with the existing policies
function mergeWithExistingPolicies(existingPolicies, manifestContractMethods) {
  const mergedPolicies = { contracts: {} };

  // Start with all contracts from the manifest
  Object.keys(manifestContractMethods).forEach((contractAddress) => {
    mergedPolicies.contracts[contractAddress] = {
      methods: [...manifestContractMethods[contractAddress]],
    };
  });

  // Add any contracts from existing policies that aren't in the manifest
  Object.keys(existingPolicies.contracts || {}).forEach((contractAddress) => {
    if (!mergedPolicies.contracts[contractAddress]) {
      mergedPolicies.contracts[contractAddress] = {
        methods: [...(existingPolicies.contracts[contractAddress].methods || [])],
      };
    } else {
      // For contracts that exist in both, merge the methods
      const existingMethods = existingPolicies.contracts[contractAddress].methods || [];

      existingMethods.forEach((existingMethod) => {
        // Check if this method already exists in the merged policies
        const methodExists = mergedPolicies.contracts[contractAddress].methods.some(
          (method) => method.entrypoint === existingMethod.entrypoint,
        );

        // If not, add it
        if (!methodExists) {
          mergedPolicies.contracts[contractAddress].methods.push(existingMethod);
        } else {
          // If it exists, update it to preserve any custom properties like description
          const index = mergedPolicies.contracts[contractAddress].methods.findIndex(
            (method) => method.entrypoint === existingMethod.entrypoint,
          );

          if (index !== -1 && existingMethod.description) {
            mergedPolicies.contracts[contractAddress].methods[index].description = existingMethod.description;
          }
        }
      });
    }
  });

  return mergedPolicies;
}

// Function to generate the updated policies file content
function generateUpdatedPoliciesContent(updatedPolicies) {
  // Start with the import statements
  let content = `import { toSessionPolicies } from "@cartridge/controller";\n`;
  content += `import { messages } from "./signing-policy";\n\n`;
  content += `export const policies = toSessionPolicies({\n`;

  // Add the contracts section
  content += `  contracts: {\n`;

  Object.keys(updatedPolicies.contracts).forEach((address, index) => {
    const contract = updatedPolicies.contracts[address];

    content += `    "${address}": {\n`;
    content += `      methods: [\n`;

    contract.methods.forEach((method, methodIndex) => {
      content += `        {\n`;
      content += `          name: "${method.name}",\n`;

      if (method.description) {
        content += `          description: "${method.description}",\n`;
      }

      content += `          entrypoint: "${method.entrypoint}",\n`;
      content += `        }${methodIndex < contract.methods.length - 1 ? "," : ""}\n`;
    });

    content += `      ],\n`;
    content += `    }${index < Object.keys(updatedPolicies.contracts).length - 1 ? "," : ""}\n`;
  });

  content += `  },\n`;

  // Add the messages reference
  content += `  messages,\n`;

  content += `});\n`;

  return content;
}

// If run directly, default to sepolia
if (import.meta.url === `file://${process.argv[1]}`) {
  const network = process.argv[2] || "sepolia";
  updatePoliciesWithManifestMethods(network, policiesPath);
}

export { updatePoliciesWithManifestMethods };
