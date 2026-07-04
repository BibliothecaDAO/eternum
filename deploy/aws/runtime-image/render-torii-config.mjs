const namespaces = (process.env.TORII_NAMESPACES || "s1_eternum")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const contracts = (process.env.TORII_EXTERNAL_CONTRACTS || "")
  .split(/\r?\n|,/)
  .map((value) => value.trim())
  .filter(Boolean);

function tomlList(values) {
  return values.map((value) => JSON.stringify(value)).join(", ");
}

function tomlString(value) {
  return JSON.stringify(value);
}

function renderWorldBlock() {
  const value = process.env.TORII_WORLD_BLOCK?.trim();
  if (!value) {
    return "";
  }

  const block = Number(value);
  if (!Number.isInteger(block) || block < 0) {
    throw new Error(`Invalid TORII_WORLD_BLOCK: ${value}`);
  }

  return `world_block = ${block}\n`;
}

process.stdout.write(`rpc = ${tomlString(process.env.RPC_URL || "")}
world_address = ${tomlString(process.env.WORLD_ADDRESS || "")}
db_dir = ${tomlString(`${process.env.DATA_DIR || "/data"}/torii`)}

[indexing]
${renderWorldBlock()}events_chunk_size = 1024
blocks_chunk_size = 10240
pending = true
polling_interval = 250
controllers = true
pre_confirmed = true
max_concurrent_tasks = 100
transactions = true
contracts = [${tomlList(contracts)}]
namespaces = [${tomlList(namespaces)}]

[sql]
all_model_indices = false

[server]
http_addr = "127.0.0.1"
http_port = ${Number(process.env.INTERNAL_PORT || "8081")}
http_cors_origins = ["*"]

[events]
raw = false
`);
