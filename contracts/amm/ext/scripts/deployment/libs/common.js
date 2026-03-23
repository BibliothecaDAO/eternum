import colors from "colors";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { json } from "starknet";
import { getAccount, getNetwork } from "./network.js";

colors.america;

const mkdirAsync = promisify(fs.mkdir);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

export const getContracts = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target directory not found at path: ${targetPath}`);
  }

  const contracts = fs.readdirSync(targetPath).filter((contract) => contract.includes(".contract_class.json"));

  if (contracts.length === 0) {
    throw new Error("No build files found. Run `scarb build` first");
  }

  return contracts;
};

export const getContractPath = (targetPath, projectName, contractName) => {
  const fileName = `${projectName}_${contractName}`;
  const contracts = getContracts(targetPath);
  const contractFile = contracts.find((contract) => contract.includes(fileName));

  if (!contractFile) {
    throw new Error(`Contract not found: ${fileName}`);
  }

  console.log(`\nFound contract path at ${contractFile}...\n`.blue);
  return path.join(targetPath, contractFile);
};

export const declareContract = async (filepath, contractName) => {
  console.log(`\nDeclaring ${contractName}...\n\n`.magenta);

  const compiledSierraCasm = filepath.replace(".contract_class.json", ".compiled_contract_class.json");
  const compiledFile = json.parse(fs.readFileSync(filepath).toString("ascii"));
  const compiledSierraCasmFile = json.parse(fs.readFileSync(compiledSierraCasm).toString("ascii"));

  const account = getAccount();
  const contract = await account.declareIfNot({
    casm: compiledSierraCasmFile,
    contract: compiledFile,
  });

  const network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("- Class Hash: ".magenta, `${contract.class_hash}`);

  if (contract.transaction_hash) {
    console.log("- Tx Hash: ".magenta, `${network.explorer_url}/tx/${contract.transaction_hash}`);
    await account.waitForTransaction(contract.transaction_hash);
  } else {
    console.log("- Tx Hash: ".magenta, "Already declared");
  }

  return contract;
};

export const deployContract = async (name, classHash, constructorCalldata) => {
  const udc = {
    ADDRESS: "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf",
    ENTRYPOINT: "deployContract",
  };

  const account = getAccount();
  account.deployer.address = udc.ADDRESS;
  account.deployer.entryPoint = udc.ENTRYPOINT;

  console.log(`\nDeploying ${name}...\n\n`.green);

  const contract = await account.deployContract({
    classHash,
    constructorCalldata,
  });

  const network = getNetwork(process.env.STARKNET_NETWORK);
  console.log("Tx hash: ".green, `${network.explorer_url}/tx/${contract.transaction_hash}`);
  await account.waitForTransaction(contract.transaction_hash);
  console.log("Contract Address: ".green, contract.address, "\n\n");

  await writeDeploymentToFile(name, contract.address, constructorCalldata);

  return contract.address;
};

export const writeDeploymentToFile = async (contractName, address, calldata) => {
  const folderPath = process.env.DEPLOYMENT_ADDRESSES_FOLDER;
  await mkdirAsync(folderPath, { recursive: true });

  const fileName = path.join(folderPath, `${contractName}.json`);
  const data = {
    address,
    calldata,
    deployed_at: Date.now(),
    deployed_at_readable: new Date().toUTCString(),
  };

  const jsonString = JSON.stringify(
    data,
    (key, value) => {
      if (typeof value === "bigint") {
        return `0x${value.toString(16)}`;
      }

      return value;
    },
    2,
  );

  await writeFileAsync(fileName, jsonString);
  console.log(`"${fileName}" has been saved or overwritten`);
};

export const readJsonFile = async (filepath) => {
  const content = await readFileAsync(filepath, "utf8");
  return JSON.parse(content);
};

export const writeJsonFile = async (filepath, data) => {
  await writeFileAsync(
    filepath,
    JSON.stringify(
      data,
      (key, value) => {
        if (typeof value === "bigint") {
          return `0x${value.toString(16)}`;
        }

        return value;
      },
      2,
    ),
  );
};
