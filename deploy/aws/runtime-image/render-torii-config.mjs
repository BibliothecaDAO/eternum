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

process.stdout.write(`rpc = "${process.env.RPC_URL || ""}"
world_address = "${process.env.WORLD_ADDRESS || ""}"
db_dir = "${process.env.DATA_DIR || "/data"}/torii"

[indexing]
events_chunk_size = 1024
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
