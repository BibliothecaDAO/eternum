use serenity::futures::StreamExt;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::sleep;

use starknet_crypto::Felt;

use torii_grpc::types::{EntityKeysClause, KeysClause};

use crate::types::{Config, EventHandler, GameEvent};

pub struct ToriiClient {
    client: torii_client::client::Client,
}

impl ToriiClient {
    pub async fn new(config: Config) -> Self {
        let client = torii_client::client::Client::new(
            config.torii_url.clone(),
            config.node_url.clone(),
            config.torii_relay_url.clone(),
            Felt::from_hex_unchecked(&config.world_address.clone()),
        )
        .await
        .unwrap();

        Self { client }
    }

    pub fn subscribe(self, processed_event_sender: mpsc::Sender<GameEvent>) {
        let event_handler = EventHandler {
            processed_event_sender,
        };

        tokio::spawn(async move {
            tracing::info!("Setting up Torii client");
            let mut tries = 0;
            let max_num_tries = 200;

            let mut backoff = Duration::from_secs(1);
            let max_backoff = Duration::from_secs(60);

            loop {
                let rcv: Result<
                    torii_grpc::client::EntityUpdateStreaming,
                    torii_client::client::error::Error,
                > = self
                    .client
                    .on_event_message_updated(
                        vec![EntityKeysClause::Keys(KeysClause {
                            keys: vec![],
                            pattern_matching: torii_grpc::types::PatternMatching::VariableLen,
                            models: vec![],
                        })],
                        true,
                    )
                    .await;

                match rcv {
                    Ok(mut rcv) => {
                        backoff = Duration::from_secs(1);

                        while let Some(Ok((_, entity))) = rcv.next().await {
                            tracing::info!("Received event");
                            event_handler.handle_event(entity).await;
                        }
                    }
                    Err(_) => {
                        tracing::warn!("Subscription was lost, attempting to reconnect");
                        tries += 1;
                    }
                }

                sleep(backoff).await;
                backoff = std::cmp::min(backoff * 2, max_backoff);

                if tries >= max_num_tries {
                    tracing::error!("Max number of tries reached, exiting");
                    break;
                }
            }

            tracing::error!("Torii client disconnected");
        });
    }
}
