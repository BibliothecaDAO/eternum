import { describe, it, expect, beforeAll } from "vitest";
import { RpcProvider, cairo } from "starknet";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration (same as distribute.js)
const LORDS_CONTRACT_ADDRESS = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
const RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet";
const LORDS_DECIMALS = 18;

// Helper functions (same as distribute.js)
function toUint256(amount) {
  // Handle decimal amounts by converting to string and parsing
  const amountStr = amount.toString();
  let amountWei;

  if (amountStr.includes(".")) {
    const [whole, decimal] = amountStr.split(".");
    const paddedDecimal = decimal.padEnd(LORDS_DECIMALS, "0").slice(0, LORDS_DECIMALS);
    amountWei = BigInt(whole + paddedDecimal);
  } else {
    amountWei = BigInt(amount) * BigInt(10 ** LORDS_DECIMALS);
  }

  return cairo.uint256(amountWei);
}

function loadCSV(filePath) {
  const csvContent = fs.readFileSync(filePath, "utf-8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record) => ({
    address: record.address,
    registeredFor: record.registered_for,
    numGames: parseInt(record.num_games),
    reimbursementLords: parseFloat(record.reimbursement_lords),
  }));
}

function buildTransferCalls(recipients) {
  return recipients.map((recipient) => ({
    contractAddress: LORDS_CONTRACT_ADDRESS,
    entrypoint: "transfer",
    calldata: [
      recipient.address,
      toUint256(recipient.reimbursementLords).low,
      toUint256(recipient.reimbursementLords).high,
    ],
  }));
}

// Tests
describe("CSV Parsing", () => {
  it("should parse the CSV file correctly", () => {
    const csvPath = path.join(__dirname, "reimbursements.csv");
    const recipients = loadCSV(csvPath);

    expect(recipients.length).toBe(51);
    expect(recipients[0].address).toBe("0x000a7cf6ec8701d810193d1384a1a70b812ab53ef7f2bd94fdfe8fb5da8a02ae");
    expect(recipients[0].reimbursementLords).toBe(250);
    expect(recipients[0].numGames).toBe(1);
  });

  it("should handle addresses with multiple games", () => {
    const csvPath = path.join(__dirname, "reimbursements.csv");
    const recipients = loadCSV(csvPath);

    // Find a recipient with multiple games
    const multiGameRecipient = recipients.find((r) => r.numGames === 5);
    expect(multiGameRecipient).toBeDefined();
    expect(multiGameRecipient.reimbursementLords).toBe(1250);
  });

  it("should calculate correct total LORDS", () => {
    const csvPath = path.join(__dirname, "reimbursements.csv");
    const recipients = loadCSV(csvPath);

    const totalLords = recipients.reduce((sum, r) => sum + r.reimbursementLords, 0);
    expect(totalLords).toBe(31500);
  });
});

describe("Amount Conversion", () => {
  it("should convert 250 LORDS to correct wei value", () => {
    const uint256 = toUint256(250);
    const expectedWei = BigInt(250) * BigInt(10 ** 18);

    // Reconstruct the full value from low and high
    const fullValue = BigInt(uint256.low) + (BigInt(uint256.high) << 128n);
    expect(fullValue).toBe(expectedWei);
  });

  it("should convert 1250 LORDS to correct wei value", () => {
    const uint256 = toUint256(1250);
    const expectedWei = BigInt(1250) * BigInt(10 ** 18);

    const fullValue = BigInt(uint256.low) + (BigInt(uint256.high) << 128n);
    expect(fullValue).toBe(expectedWei);
  });

  it("should handle decimal amounts correctly", () => {
    const uint256 = toUint256(100.5);
    // 100.5 LORDS = 100.5 * 10^18 wei
    const expectedWei = BigInt("100500000000000000000");

    const fullValue = BigInt(uint256.low) + (BigInt(uint256.high) << 128n);
    expect(fullValue).toBe(expectedWei);
  });
});

describe("Transfer Call Building", () => {
  it("should build correct transfer calls", () => {
    const recipients = [
      {
        address: "0x000a7cf6ec8701d810193d1384a1a70b812ab53ef7f2bd94fdfe8fb5da8a02ae",
        registeredFor: "game2",
        numGames: 1,
        reimbursementLords: 250,
      },
    ];

    const calls = buildTransferCalls(recipients);

    expect(calls.length).toBe(1);
    expect(calls[0].contractAddress).toBe(LORDS_CONTRACT_ADDRESS);
    expect(calls[0].entrypoint).toBe("transfer");
    expect(calls[0].calldata[0]).toBe(recipients[0].address);
  });

  it("should build multiple transfer calls", () => {
    const csvPath = path.join(__dirname, "reimbursements.csv");
    const recipients = loadCSV(csvPath);
    const calls = buildTransferCalls(recipients);

    expect(calls.length).toBe(51);
    calls.forEach((call) => {
      expect(call.contractAddress).toBe(LORDS_CONTRACT_ADDRESS);
      expect(call.entrypoint).toBe("transfer");
      expect(call.calldata.length).toBe(3); // recipient, low, high
    });
  });
});

describe("Starknet Contract Integration", () => {
  let provider;

  beforeAll(() => {
    provider = new RpcProvider({ nodeUrl: RPC_URL });
  });

  it("should connect to Starknet mainnet", async () => {
    const chainId = await provider.getChainId();
    expect(chainId).toBeDefined();
    // Mainnet chain ID
    expect(chainId).toBe("0x534e5f4d41494e");
  });

  it("should verify LORDS contract exists", async () => {
    const classHash = await provider.getClassHashAt(LORDS_CONTRACT_ADDRESS, "latest");
    expect(classHash).toBeDefined();
    expect(classHash.startsWith("0x")).toBe(true);
  });

  it("should read LORDS token decimals", async () => {
    const result = await provider.callContract(
      {
        contractAddress: LORDS_CONTRACT_ADDRESS,
        entrypoint: "decimals",
        calldata: [],
      },
      "latest",
    );
    expect(Number(result[0])).toBe(18);
  });

  it("should be able to query balance of any address", async () => {
    // Query balance of a known address (the contract itself as a test)
    const result = await provider.callContract(
      {
        contractAddress: LORDS_CONTRACT_ADDRESS,
        entrypoint: "balance_of",
        calldata: [LORDS_CONTRACT_ADDRESS],
      },
      "latest",
    );
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Address Validation", () => {
  it("should have valid Starknet addresses in CSV", () => {
    const csvPath = path.join(__dirname, "reimbursements.csv");
    const recipients = loadCSV(csvPath);

    recipients.forEach((recipient) => {
      // Starknet addresses should start with 0x and be 66 characters (including 0x)
      expect(recipient.address.startsWith("0x")).toBe(true);
      expect(recipient.address.length).toBe(66);
    });
  });

  it("should have no duplicate addresses in CSV", () => {
    const csvPath = path.join(__dirname, "reimbursements.csv");
    const recipients = loadCSV(csvPath);

    const addresses = recipients.map((r) => r.address.toLowerCase());
    const uniqueAddresses = new Set(addresses);

    expect(uniqueAddresses.size).toBe(addresses.length);
  });

  it("should have positive reimbursement amounts", () => {
    const csvPath = path.join(__dirname, "reimbursements.csv");
    const recipients = loadCSV(csvPath);

    recipients.forEach((recipient) => {
      expect(recipient.reimbursementLords).toBeGreaterThan(0);
    });
  });
});
