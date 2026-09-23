use anyhow::Context;
use realms_gateway::{run, GatewayConfig, NodeConfig};
use starknet_types_core::felt::Felt;

fn required(name: &str) -> anyhow::Result<String> {
    std::env::var(name).with_context(|| format!("missing {name}"))
}

fn felt(name: &str) -> anyhow::Result<Felt> {
    Felt::from_hex(&required(name)?).with_context(|| format!("{name} is not a felt"))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter(tracing_subscriber::EnvFilter::from_default_env()).init();
    run(GatewayConfig {
        node: NodeConfig {
            rpc_url: required("NODE_RPC_URL")?,
            ws_url: required("NODE_WS_URL")?,
            deployment: felt("RANDOMNESS_DEPLOYMENT")?,
            account: felt("RANDOMNESS_ACCOUNT")?,
            key: felt("RANDOMNESS_PRIVATE_KEY")?,
        },
        listen: required("GATEWAY_LISTEN")?.parse().context("GATEWAY_LISTEN is not a socket address")?,
        max_connections: required("GATEWAY_MAX_CONNECTIONS")?
            .parse()
            .context("GATEWAY_MAX_CONNECTIONS is not a connection count")?,
        epoch_secret: required("RANDOMNESS_EPOCH_SECRET")?.into(),
    })
    .await
}
