import { parse } from "csv-parse/sync";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { Account, RpcProvider, cairo } from "starknet";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LORDS_CONTRACT_ADDRESS = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
const RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_7";
const LORDS_DECIMALS = 18;
const BATCH_SIZE = 25; // Number of transfers per batch transaction

// Function selectors for ERC20
const BALANCE_OF_SELECTOR = "0x35a73cd311a05d46deda634c5ee045db92f811b4e74bca4437fcb5302b7af33"; // balance_of

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function toUint256(amount) {
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

// Checkpoint functions
function getCheckpointPath(csvPath) {
  const baseName = path.basename(csvPath, path.extname(csvPath));
  return path.join(__dirname, `.checkpoint-${baseName}.json`);
}

function loadCheckpoint(csvPath) {
  const checkpointPath = getCheckpointPath(csvPath);
  if (fs.existsSync(checkpointPath)) {
    const data = JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
    return data;
  }
  return {
    completedAddresses: [],
    completedBatches: 0,
    totalLordsSent: 0,
    transactions: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

function saveCheckpoint(csvPath, checkpoint) {
  const checkpointPath = getCheckpointPath(csvPath);
  checkpoint.lastUpdated = new Date().toISOString();
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  log(`   💾 Checkpoint saved: ${checkpoint.completedAddresses.length} addresses processed`, colors.cyan);
}

function clearCheckpoint(csvPath) {
  const checkpointPath = getCheckpointPath(csvPath);
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }
}

async function main() {
  // Check for CSV file argument
  const csvPath = process.argv[2];
  if (!csvPath) {
    log("Error: Please provide path to CSV file", colors.red);
    log("\nUsage: node distribute.js <path-to-csv> [options]", colors.yellow);
    log("Options:", colors.yellow);
    log("  --dry-run     Preview without sending transactions", colors.cyan);
    log("  --reset       Clear checkpoint and start fresh", colors.cyan);
    log("  --status      Show current checkpoint status", colors.cyan);
    log("\nExample: node distribute.js ./reimbursements.csv", colors.cyan);
    process.exit(1);
  }

  // Check for flags
  const isDryRun = process.argv.includes("--dry-run");
  const isReset = process.argv.includes("--reset");
  const isStatus = process.argv.includes("--status");

  // Check environment variables (not required for dry-run or status)
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  const privateKey = process.env.PRIVATE_KEY;

  if (!isDryRun && !isStatus && (!accountAddress || !privateKey)) {
    log("Error: ACCOUNT_ADDRESS and PRIVATE_KEY must be set in .env file", colors.red);
    log("\nCreate a .env file with:", colors.yellow);
    log("ACCOUNT_ADDRESS=0x...", colors.cyan);
    log("PRIVATE_KEY=0x...", colors.cyan);
    process.exit(1);
  }

  // Load checkpoint
  let checkpoint = loadCheckpoint(csvPath);

  // Handle --reset flag
  if (isReset) {
    clearCheckpoint(csvPath);
    checkpoint = loadCheckpoint(csvPath);
    log("\n🔄 Checkpoint cleared. Starting fresh.\n", colors.yellow);
  }

  // Handle --status flag
  if (isStatus) {
    log("\n📊 Checkpoint Status:", colors.blue);
    log(`   Started at: ${checkpoint.startedAt}`, colors.cyan);
    log(`   Last updated: ${checkpoint.lastUpdated}`, colors.cyan);
    log(`   Completed addresses: ${checkpoint.completedAddresses.length}`, colors.cyan);
    log(`   Completed batches: ${checkpoint.completedBatches}`, colors.cyan);
    log(`   Total LORDS sent: ${checkpoint.totalLordsSent}`, colors.cyan);
    if (checkpoint.transactions.length > 0) {
      log(`   Transactions:`, colors.cyan);
      checkpoint.transactions.forEach((tx, i) => {
        log(`     ${i + 1}. ${tx.hash} (${tx.count} transfers, ${tx.lords} LORDS)`, colors.cyan);
      });
    }
    return;
  }

  if (isDryRun) {
    log("\n🔍 DRY RUN MODE - No transactions will be sent\n", colors.yellow);
  }

  // Load CSV data
  log(`\n📄 Loading CSV file: ${csvPath}`, colors.blue);
  const allRecipients = loadCSV(csvPath);
  log(`Found ${allRecipients.length} total recipients`, colors.green);

  // Filter out already processed addresses
  const completedSet = new Set(checkpoint.completedAddresses.map((a) => a.toLowerCase()));
  const recipients = allRecipients.filter((r) => !completedSet.has(r.address.toLowerCase()));

  if (recipients.length === 0) {
    log("\n✅ All recipients have already been processed!", colors.green);
    log(`   Total LORDS distributed: ${checkpoint.totalLordsSent}`, colors.cyan);
    log(`   Transactions: ${checkpoint.transactions.length}`, colors.cyan);
    log("\nUse --reset flag to start over if needed.", colors.yellow);
    return;
  }

  if (checkpoint.completedAddresses.length > 0) {
    log(`\n📍 Resuming from checkpoint:`, colors.yellow);
    log(`   Already processed: ${checkpoint.completedAddresses.length} addresses`, colors.cyan);
    log(`   Remaining: ${recipients.length} addresses`, colors.cyan);
  }

  // Calculate amounts
  const totalLordsRemaining = recipients.reduce((sum, r) => sum + r.reimbursementLords, 0);
  const totalLordsAll = allRecipients.reduce((sum, r) => sum + r.reimbursementLords, 0);
  log(`\nLORDS to distribute: ${totalLordsRemaining} (${totalLordsAll} total)`, colors.cyan);

  // Split into batches
  const batches = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    batches.push(recipients.slice(i, i + BATCH_SIZE));
  }

  log(`\n📦 Split into ${batches.length} batch(es) of up to ${BATCH_SIZE} transfers each`, colors.blue);

  // Handle dry-run mode (no network calls needed)
  if (isDryRun) {
    log("\n📋 Recipients to process:", colors.blue);
    recipients.forEach((r, i) => {
      log(`  ${i + 1}. ${r.address} -> ${r.reimbursementLords} LORDS`, colors.cyan);
    });
    log("\n🔍 Dry run complete. Remove --dry-run flag to execute transfers.", colors.yellow);
    return;
  }

  // Initialize provider and account (only for actual execution)
  log(`\n🔗 Connecting to Starknet mainnet...`, colors.blue);
  const provider = new RpcProvider({ nodeUrl: RPC_URL, chainId: "0x534e5f4d41494e" });
  // Starknet.js v8 uses options object for Account constructor
  const account = new Account({
    provider,
    address: accountAddress,
    signer: privateKey,
  });

  // Check sender balance using raw call
  log(`\n💰 Checking sender balance...`, colors.blue);
  const balanceResult = await provider.callContract(
    {
      contractAddress: LORDS_CONTRACT_ADDRESS,
      entrypoint: "balance_of",
      calldata: [accountAddress],
    },
    "latest",
  );
  // balance_of returns u256 (low, high)
  const balanceLow = BigInt(balanceResult[0]);
  const balanceHigh = BigInt(balanceResult[1] || "0");
  const balance = balanceLow + (balanceHigh << 128n);
  const balanceFormatted = Number(balance) / 10 ** LORDS_DECIMALS;
  log(`Sender balance: ${balanceFormatted.toLocaleString()} LORDS`, colors.cyan);

  if (balanceFormatted < totalLordsRemaining) {
    log(`\n❌ Insufficient LORDS balance!`, colors.red);
    log(`   Need: ${totalLordsRemaining} LORDS`, colors.red);
    log(`   Have: ${balanceFormatted} LORDS`, colors.red);
    log(`\nFix your balance and re-run. Progress has been saved.`, colors.yellow);
    process.exit(1);
  }

  log(`\n✅ Sufficient balance to distribute ${totalLordsRemaining} LORDS`, colors.green);

  // Confirm before proceeding
  log("\n⚠️  About to distribute LORDS:", colors.yellow);
  log(`   Remaining recipients: ${recipients.length}`, colors.cyan);
  log(`   Remaining LORDS: ${totalLordsRemaining}`, colors.cyan);
  log(`   Batches to process: ${batches.length}`, colors.cyan);
  log(`\nPress Ctrl+C to cancel, or wait 5 seconds to continue...`, colors.yellow);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Process batches
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchLords = batch.reduce((sum, r) => sum + r.reimbursementLords, 0);

    log(`\n${"═".repeat(60)}`, colors.blue);
    log(
      `📤 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} transfers, ${batchLords} LORDS)`,
      colors.blue,
    );
    log("═".repeat(60), colors.blue);

    // Build calls for this batch
    const calls = batch.map((recipient) => ({
      contractAddress: LORDS_CONTRACT_ADDRESS,
      entrypoint: "transfer",
      calldata: [
        recipient.address,
        toUint256(recipient.reimbursementLords).low,
        toUint256(recipient.reimbursementLords).high,
      ],
    }));

    try {
      // Execute batch using V3 transaction (pays gas in STRK)
      // starknet.js v8 defaults to V3 transactions
      log(`\n   🚀 Submitting V3 transaction (gas paid in STRK)...`, colors.blue);
      const tx = await account.execute(calls);
      log(`   ✅ Transaction submitted: ${tx.transaction_hash}`, colors.green);
      log(`   🔗 Explorer: https://starkscan.co/tx/${tx.transaction_hash}`, colors.magenta);

      // Wait for confirmation
      log(`   ⏳ Waiting for confirmation...`, colors.yellow);
      const receipt = await account.waitForTransaction(tx.transaction_hash);

      if (receipt.isSuccess()) {
        log(`   🎉 Batch ${batchIndex + 1} confirmed! Block: ${receipt.block_number}`, colors.green);

        // Update checkpoint
        batch.forEach((r) => checkpoint.completedAddresses.push(r.address));
        checkpoint.completedBatches++;
        checkpoint.totalLordsSent += batchLords;
        checkpoint.transactions.push({
          hash: tx.transaction_hash,
          block: receipt.block_number,
          count: batch.length,
          lords: batchLords,
          timestamp: new Date().toISOString(),
        });
        saveCheckpoint(csvPath, checkpoint);
      } else {
        log(`\n   ❌ Batch ${batchIndex + 1} failed!`, colors.red);
        log(`   Transaction may have been rejected. Check the explorer.`, colors.red);
        log(`   Progress saved. Re-run the script to retry this batch.`, colors.yellow);
        console.log(receipt);
        process.exit(1);
      }
    } catch (error) {
      log(`\n   ❌ Error processing batch ${batchIndex + 1}:`, colors.red);
      console.error(error.message || error);

      if (error.message?.includes("insufficient") || error.message?.includes("balance")) {
        log(`\n   💸 This might be a balance issue (LORDS or STRK for gas).`, colors.yellow);
      }

      log(`\n   📍 Progress saved at checkpoint. Fix the issue and re-run.`, colors.yellow);
      log(`   Completed: ${checkpoint.completedAddresses.length}/${allRecipients.length} addresses`, colors.cyan);
      process.exit(1);
    }

    // Small delay between batches to avoid rate limiting
    if (batchIndex < batches.length - 1) {
      log(`   ⏱️  Waiting 2s before next batch...`, colors.cyan);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Final summary
  log("\n" + "═".repeat(60), colors.green);
  log(`${colors.bold}🎉 DISTRIBUTION COMPLETE!${colors.reset}`, colors.green);
  log("═".repeat(60), colors.green);
  log(`   Total recipients: ${checkpoint.completedAddresses.length}`, colors.cyan);
  log(`   Total LORDS distributed: ${checkpoint.totalLordsSent}`, colors.cyan);
  log(`   Total transactions: ${checkpoint.transactions.length}`, colors.cyan);
  log("═".repeat(60), colors.green);

  // Clear checkpoint on successful completion
  log(`\n🧹 Clearing checkpoint file...`, colors.blue);
  clearCheckpoint(csvPath);
  log(`✅ Done! Checkpoint cleared.\n`, colors.green);
}

main().catch(console.error);
