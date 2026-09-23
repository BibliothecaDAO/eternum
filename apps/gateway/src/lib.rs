//! Admission beside a stock Madara node: players' signed intents become recorded executions,
//! each in its own game's order, with epoch-committed randomness.

mod admission;
mod epoch;
mod execution;
mod node;
pub mod protocol;
mod service;
mod socket;
mod ticket;
mod transaction;

use anyhow::Context;
use hyper::{
    server::conn::AddrStream,
    service::{make_service_fn, service_fn},
};
use jsonrpsee::server::{stop_channel, Server};
pub use node::NodeConfig;
use starknet_types_core::felt::Felt;
use std::{net::SocketAddr, path::PathBuf};

pub struct GatewayConfig {
    pub node: NodeConfig,
    pub listen: SocketAddr,
    /// The shard's admission connection budget, derived from its player capacity by the shard runner.
    pub max_connections: u32,
    /// Players the shard hosts; it bounds their pending tickets.
    pub player_capacity: usize,
    /// The operator account whose administrative work has its own allowance.
    pub authority: Felt,
    pub epoch_secret: PathBuf,
}

/// Serves `game_subscribeAction` and runs admission until the process stops.
pub async fn run(config: GatewayConfig) -> anyhow::Result<()> {
    let node = node::Node::connect(config.node).await?;
    let api = service::GameApi::new(node, admission::AdmissionSlots::new(config.player_capacity, config.authority));
    tokio::spawn(api.clone().run_forever(config.epoch_secret));
    serve(api, config.listen, config.max_connections).await
}

/// One JSON-RPC module per TCP connection, so each carries its peer for the per-address cap.
async fn serve(api: service::GameApi, listen: SocketAddr, max_connections: u32) -> anyhow::Result<()> {
    let (stop, _server) = stop_channel();
    let builder = Server::builder().max_connections(max_connections).to_service_builder();
    let make_service = make_service_fn(move |connection: &AddrStream| {
        let module = api.rpc(connection.remote_addr().ip());
        let (builder, stop) = (builder.clone(), stop.clone());
        async move {
            let module = module.map_err(|error| std::io::Error::other(error.to_string()))?;
            Ok::<_, std::io::Error>(service_fn(move |request| {
                let mut service = builder.clone().build(module.clone(), stop.clone());
                async move { hyper::service::Service::call(&mut service, request).await }
            }))
        }
    });
    tracing::info!(target: "gateway", %listen, "gateway listening");
    hyper::Server::try_bind(&listen).context("bind the gateway address")?.serve(make_service).await?;
    Ok(())
}
