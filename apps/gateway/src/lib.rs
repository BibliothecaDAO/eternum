//! Admission beside a stock Madara node: players' signed intents become recorded executions,
//! each in its own game's order, with epoch-committed randomness.

mod admission;
mod epoch;
mod execution;
mod metrics;
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
    HeaderMap,
};
use jsonrpsee::server::{stop_channel, Server};
pub use node::NodeConfig;
use starknet_types_core::felt::Felt;
use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
};

pub struct GatewayConfig {
    pub node: NodeConfig,
    pub listen: SocketAddr,
    /// Where the collector scrapes admission metrics; never published beside the admission port.
    pub metrics_listen: SocketAddr,
    /// The shard's admission connection budget, derived from its player capacity by the shard runner.
    pub max_connections: u32,
    /// Players the shard hosts; it bounds their pending tickets.
    pub player_capacity: usize,
    /// The operator account whose administrative work has its own allowance.
    pub authority: Felt,
    /// The reverse proxy in front of the gateway, if any; only its forwarded address is trusted.
    pub trusted_proxy: Option<IpAddr>,
    pub epoch_secret: PathBuf,
}

/// Serves `game_subscribeAction` and runs admission until the process stops.
pub async fn run(config: GatewayConfig) -> anyhow::Result<()> {
    let node = node::Node::connect(config.node).await?;
    let api = service::GameApi::new(node, admission::AdmissionSlots::new(config.player_capacity, config.authority));
    tokio::spawn(api.clone().run_forever(config.epoch_secret));
    tokio::try_join!(
        serve_metrics(api.clone(), config.metrics_listen),
        serve(api, config.listen, config.max_connections, config.trusted_proxy),
    )?;
    Ok(())
}

/// Metrics describe every player's admission, so they stay off the listener players reach.
async fn serve_metrics(api: service::GameApi, listen: SocketAddr) -> anyhow::Result<()> {
    let make_service = make_service_fn(move |_: &AddrStream| {
        let api = api.clone();
        async move {
            Ok::<_, std::convert::Infallible>(service_fn(move |_request: hyper::Request<hyper::Body>| {
                let metrics = api.metrics();
                async move { Ok::<_, std::convert::Infallible>(hyper::Response::new(hyper::Body::from(metrics))) }
            }))
        }
    });
    tracing::info!(target: "gateway", %listen, "gateway metrics listening");
    hyper::Server::try_bind(&listen).context("bind the gateway metrics address")?.serve(make_service).await?;
    Ok(())
}

/// One JSON-RPC module per request, so each carries its client's address for the per-address cap.
async fn serve(
    api: service::GameApi,
    listen: SocketAddr,
    max_connections: u32,
    trusted_proxy: Option<IpAddr>,
) -> anyhow::Result<()> {
    let (stop, _server) = stop_channel();
    let builder = Server::builder().max_connections(max_connections).to_service_builder();
    let make_service = make_service_fn(move |connection: &AddrStream| {
        let peer = connection.remote_addr().ip();
        let (api, builder, stop) = (api.clone(), builder.clone(), stop.clone());
        async move {
            Ok::<_, std::io::Error>(service_fn(move |request: hyper::Request<hyper::Body>| {
                let module = api.rpc(client_address(peer, trusted_proxy, request.headers()));
                let (builder, stop) = (builder.clone(), stop.clone());
                async move {
                    let mut service = builder.build(module?, stop);
                    hyper::service::Service::call(&mut service, request).await
                }
            }))
        }
    });
    tracing::info!(target: "gateway", %listen, "gateway listening");
    hyper::Server::try_bind(&listen).context("bind the gateway address")?.serve(make_service).await?;
    Ok(())
}

/// The client is the TCP peer, except behind the configured proxy, where it is the last
/// `X-Forwarded-For` entry: the one that proxy appended. Entries a client placed ahead of it, and the
/// header from any other peer, are ignored.
fn client_address(peer: IpAddr, trusted_proxy: Option<IpAddr>, headers: &HeaderMap) -> IpAddr {
    if trusted_proxy != Some(peer) {
        return peer;
    }
    headers
        .get_all("x-forwarded-for")
        .iter()
        .next_back()
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.rsplit(',').next())
        .and_then(|entry| entry.trim().parse().ok())
        .unwrap_or(peer)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn forwarded(values: &[&str]) -> HeaderMap {
        let mut headers = HeaderMap::new();
        for value in values {
            headers.append("x-forwarded-for", value.parse().unwrap());
        }
        headers
    }

    #[test]
    fn only_the_configured_proxy_can_name_a_client_and_only_by_its_own_entry() {
        let (proxy, client, other): (IpAddr, IpAddr, IpAddr) =
            ("172.18.0.1".parse().unwrap(), "203.0.113.7".parse().unwrap(), "198.51.100.9".parse().unwrap());
        // A non-proxy peer forging a forwarded address is limited by its real address.
        assert_eq!(client_address(other, Some(proxy), &forwarded(&["203.0.113.7"])), other);
        // With no proxy configured the header is never read.
        assert_eq!(client_address(proxy, None, &forwarded(&["203.0.113.7"])), proxy);
        // A forged value placed ahead of the proxy's own is ignored, in one header or several.
        assert_eq!(client_address(proxy, Some(proxy), &forwarded(&["10.9.9.9, 203.0.113.7"])), client);
        assert_eq!(client_address(proxy, Some(proxy), &forwarded(&["10.9.9.9", "203.0.113.7"])), client);
        // Without a readable entry the proxy itself is the client.
        assert_eq!(client_address(proxy, Some(proxy), &forwarded(&[])), proxy);
        assert_eq!(client_address(proxy, Some(proxy), &forwarded(&["not-an-address"])), proxy);
    }
}
