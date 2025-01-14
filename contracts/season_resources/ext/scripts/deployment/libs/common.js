import colors from "colors";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { json } from "starknet";
import { promisify } from "util";
import { getAccount, getNetwork } from "./network.js";

colors.america;
export const getContracts = (TARGET_PATH) => {
  if (!fs.existsSync(TARGET_PATH)) {
    throw new Error(`Target directory not found at path: ${TARGET_PATH}`);
  }
  const contracts = fs.readdirSync(TARGET_PATH).filter((contract) => contract.includes(".contract_class.json"));
  if (contracts.length === 0) {
    throw new Error("No build files found. Run `scarb build` first");
  }
  return contracts;
};

export const getContractPath = (TARGET_PATH, project_name, contract_name) => {
  const fileName = `${project_name}_${contract_name}`;
  const contracts = getContracts(TARGET_PATH);
  const c = contracts.find((contract) => contract.includes(fileName));
  if (!c) {
    throw new Error(`Contract not found: ${fileName}`);
  }
  console.log(`\nFound contract path at ${c}...\n`.blue);
  return path.join(TARGET_PATH, c);
};

export const declare = async (filepath, contract_name) => {
  console.log(`\nDeclaring ${contract_name}...\n\n`.magenta);
  const compiledSierraCasm = filepath.replace(".contract_class.json", ".compiled_contract_class.json");
  const compiledFile = json.parse(fs.readFileSync(filepath).toString("ascii"));
  const compiledSierraCasmFile = json.parse(fs.readFileSync(compiledSierraCasm).toString("ascii"));

  const account = getAccount();
  const contract = await account.declareIfNot({
    contract: compiledFile,
    casm: compiledSierraCasmFile,
  });

  const network = getNetwork(process.env.STARKNET_NETWORK);
  console.log(`- Class Hash: `.magenta, `${contract.class_hash}`);
  if (contract.transaction_hash) {
    console.log("- Tx Hash: ".magenta, `${network.explorer_url}/tx/${contract.transaction_hash})`);
    await account.waitForTransaction(contract.transaction_hash);
  } else {
    console.log("- Tx Hash: ".magenta, "Already declared");
  }

  return contract;
};

export const deploy = async (name, class_hash, constructorCalldata) => {
  // Deploy contract
  const account = getAccount();
  console.log(`\nDeploying ${name} ... \n\n`.green);
  let contract = await account.deployContract({
    classHash: class_hash,
    constructorCalldata: constructorCalldata,
  });

  // Wait for transaction
  let network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash})`);
  let a = await account.waitForTransaction(contract.transaction_hash);
  console.log("Contract Address: ".green, contract.address, "\n\n");

  await writeDeploymentToFile(name, contract.address, constructorCalldata);

  return contract.address;
};

const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
export const writeDeploymentToFile = async (contractName, address, calldata) => {
  try {
    const folderPath = process.env.DEPLOYMENT_ADDRESSES_FOLDER;
    await mkdirAsync(folderPath, { recursive: true });

    const fileName = path.join(folderPath, `${contractName}.json`);

    const data = {
      address,
      calldata,
      deployed_at: Date.now(),
      deployed_at_readable: new Date().toUTCString(),
    };

    // Convert BigInt to hex string
    const jsonString = JSON.stringify(
      data,
      (key, value) => {
        if (typeof value === "bigint") {
          return "0x" + value.toString(16);
        }
        return value;
      },
      2,
    );

    await writeFileAsync(fileName, jsonString);
    console.log(`"${fileName}" has been saved or overwritten`);
  } catch (err) {
    console.error("Error writing file", err);
    throw err; // Re-throw the error so the caller knows something went wrong
  }
};

const readFileAsync = promisify(fs.readFile);

export const getDeployedAddress = async (contractName) => {
  const folderPath = process.env.DEPLOYMENT_ADDRESSES_FOLDER;
  const fileName = path.join(folderPath, `${contractName}.json`);

  try {
    const data = await readFileAsync(fileName, "utf8");
    const jsonData = JSON.parse(data);
    return jsonData.address;
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`File not found: ${fileName}`);
    } else if (err instanceof SyntaxError) {
      console.error("Error parsing JSON:", err);
    } else {
      console.error("Error reading file:", err);
    }
    throw err; // Re-throw the error so the caller knows something went wrong
  }
};


export const saveResourceAddressesToFile = async (resourceAddresses) => {
  try {
    const folderPath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "..",
      "common",
      "addresses",
    );
    await mkdirAsync(folderPath, { recursive: true });

    const fileName = path.join(folderPath, `${process.env.STARKNET_NETWORK}.json`);
    
    // Try to read existing data
    let existingData = {};
    try {
      const fileContent = await readFileAsync(fileName, 'utf8');
      existingData = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is invalid JSON, start with empty object
    }

    // Merge new resources with existing data
    const updatedData = {
      ...existingData,
      resources: resourceAddresses
    };
    

    const jsonString = customStringify(updatedData);

    await writeFileAsync(fileName, jsonString);
    console.log(`"${fileName}" has been saved or overwritten`);
  } catch (err) {
    console.error("Error writing file", err);
    throw err; // Re-throw the error so the caller knows something went wrong
  }
};

export const getResourceAddressesFromFile = async () => {
  const folderPath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "common",
    "addresses",
  );
  const fileName = path.join(folderPath, `${process.env.STARKNET_NETWORK}.json`);
  const data = await readFileAsync(fileName, "utf8");
  return JSON.parse(data).resources;
};


  // Custom replacer function to keep arrays on one line
  const customStringify = (obj) => {
    // First convert to JSON string with standard formatting
    const initialString = JSON.stringify(obj, null, 2);
    
    // Replace arrays with single-line version, handling multiple lines and whitespace
    return initialString.replace(
      /\[\n\s+(.+?)\n\s+\]/gs,
      (match, content) => {
        // Remove newlines and extra spaces between array elements
        const singleLine = content.replace(/\n\s+/g, '');
        return `[${singleLine}]`;
      }
    );
  };