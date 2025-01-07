const fs = require("fs");
const path = require("path");

// Path to the manifest.json file
const manifestPath = path.join(__dirname, "..", "contracts", "manifest_mainnet.json");

// Read and parse the manifest.json
fs.readFile(manifestPath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading manifest.json:", err);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(data);
  } catch (parseErr) {
    console.error("Error parsing manifest.json:", parseErr);
    return;
  }

  const policies = [];

  // Iterate through each contract
  if (manifest.contracts && Array.isArray(manifest.contracts)) {
    manifest.contracts.forEach((contract) => {
      const { address, abi } = contract;

      console.log("abi", address);

      if (abi && Array.isArray(abi)) {
        // Search for the target function within the ABI
        abi.some((item) => {
          if (item.type === "interface" && item.name !== "dojo::contract::contract::IContract") {
            return item.items.forEach((subItem) => {
              if (subItem.name !== "world" && subItem.name !== "dojo_init" && subItem.name !== "upgrade") {
                return policies.push({
                  target: address,
                  method: subItem.name,
                });
              }
            });
          }
        });
      }
    });
  }

  // Output the result in TypeScript format
  const output = `const policies = ${JSON.stringify(policies, null, 2)};`;

  console.log(output);

  // Optionally, write the output to a TypeScript file
  const outputPath = path.join(__dirname, "..", "client", "src", "hooks", "context", "mainnet-policies.tsx");
  fs.writeFile(outputPath, `export const policies = ${JSON.stringify(policies, null, 2)};\n`, "utf8", (writeErr) => {
    if (writeErr) {
      console.error("Error writing to connectors.tsx:", writeErr);
      return;
    }
    console.log(`Policies successfully written to ${outputPath}`);
  });
});
