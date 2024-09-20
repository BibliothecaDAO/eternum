use serenity::futures::StreamExt;
use std::time::Duration;
use stream_cancel::{StreamExt as _, Tripwire};
use tokio::sync::mpsc;
use tokio::time::sleep;

use starknet_crypto::Felt;

use torii_client::client::Client as ToriiClient;
use torii_grpc::types::{EntityKeysClause, KeysClause};

use crate::types::{Config, EventHandler, GameEventData};

pub fn subscribe_with_reconnection(config: Config, event_sender: mpsc::Sender<GameEventData>) {
    let (_, tripwire) = Tripwire::new();
    let event_handler = EventHandler { event_sender };

    tokio::spawn(async move {
        tracing::info!("Setting up Torii client");
        let client = ToriiClient::new(
            config.torii_url.clone(),
            config.node_url.clone(),
            config.torii_relay_url.clone(),
            Felt::from_hex_unchecked(&config.world_address.clone()),
        )
        .await
        .unwrap();

        let mut backoff = Duration::from_secs(1);
        let max_backoff = Duration::from_secs(60);

        loop {
            let rcv = client
                .on_event_message_updated(vec![EntityKeysClause::Keys(KeysClause {
                    keys: vec![],
                    pattern_matching: torii_grpc::types::PatternMatching::VariableLen,
                    models: vec![],
                })])
                .await;

            match rcv {
                Ok(rcv) => {
                    backoff = Duration::from_secs(1); // Reset backoff on successful connection

                    let mut rcv = rcv.take_until_if(tripwire.clone());

                    while let Some(Ok((_, entity))) = rcv.next().await {
                        tracing::info!("Received event");
                        event_handler.handle_event(entity).await;
                    }
                }
                Err(_) => {
                    // Check if the tripwire has been triggered before attempting to reconnect
                    if tripwire.clone().await {
                        break; // Exit the loop if the subscription has been cancelled
                    }
                }
            }

            // If we've reached this point, the stream has ended (possibly due to disconnection)
            // We'll try to reconnect after a delay, unless the tripwire has been triggered
            if tripwire.clone().await {
                break; // Exit the loop if the subscription has been cancelled
            }
            sleep(backoff).await;
            backoff = std::cmp::min(backoff * 2, max_backoff);
        }

        tracing::error!("Torii client disconnected");
    });
}
