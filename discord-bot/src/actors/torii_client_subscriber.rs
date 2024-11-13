use cainome_cairo_serde::CairoSerde;
use dojo_types::schema::Ty;
use serenity::futures::StreamExt;
use std::time::Duration;
use tokio::select;
use tokio::sync::mpsc;
use tokio::time::sleep;

use starknet_crypto::Felt;
use torii_grpc::types::schema::Entity;

use torii_grpc::types::{EntityKeysClause, KeysClause};

use crate::{
    events::{
        battle_claim::BattleClaim, battle_join::BattleJoin, battle_leave::BattleLeave,
        battle_pillage::BattlePillage, battle_start::BattleStart, settle_realm::SettleRealm,
    },
    types::{Config, Event},
};

pub struct ToriiClientSubscriber {
    client: torii_client::client::Client,
    processed_event_sender: mpsc::Sender<Event>,
}

impl ToriiClientSubscriber {
    pub async fn new(
        config: Config,
        processed_event_sender: mpsc::Sender<Event>,
    ) -> eyre::Result<Self> {
        let client = torii_client::client::Client::new(
            config.torii_url.clone(),
            config.node_url.clone(),
            config.torii_relay_url.clone(),
            Felt::from_hex_unchecked(&config.world_address.clone()),
        )
        .await?;

        Ok(Self {
            client,
            processed_event_sender,
        })
    }

    pub async fn subscribe(self) {
        tracing::info!("Setting up Torii client");
        let mut tries = 0;
        let max_num_tries = 200;

        let mut backoff = Duration::from_secs(1);
        let max_backoff = Duration::from_secs(60);

        while tries < max_num_tries {
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
                    false,
                )
                .await;

            match rcv {
                Ok(mut rcv) => {
                    backoff = Duration::from_secs(1);
                    loop {
                        tracing::info!("Waiting for events");
                        tracing::info!("rcv is {:?}", rcv);
                        select! {
                            result = rcv.next() => {
                                match result {
                                    Some(result) => {
                                        if let Ok((_, entity)) = result {
                                            tracing::info!("Received event");
                                            self.treat_received_torii_event(entity).await;
                                            tracing::info!("Finished processing events");
                                        } else {
                                            tracing::warn!("Received invalid data from torii, reconnecting");
                                            break;
                                        }
                                    }
                                    None => {
                                        tracing::warn!("Stream returned an error, reconnecting");
                                        break;
                                    }
                                }
                            }
                            _ = sleep(Duration::from_secs(5)) => {
                                tracing::info!("No events received after 5 seconds");
                                continue;
                            }
                        }
                    }
                }
                Err(_) => {
                    tracing::warn!("Subscription was lost, attempting to reconnect");
                    tries += 1;
                }
            }

            sleep(backoff).await;
            backoff = std::cmp::min(backoff * 2, max_backoff);
        }

        tracing::error!("Torii client disconnected, reached max number of tries");
    }

    async fn treat_received_torii_event(&self, entity: Entity) {
        for model in entity.models {
            let ty = Ty::Struct(model.clone());

            let felts = ty.serialize().unwrap();

            tracing::info!("FELTS: {:?}", felts);
            tracing::info!("MODEL NAME: {:?}", model.name);

            let event = match model.name.as_str() {
                "eternum-BattleStartData" => {
                    let event = BattleStart::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.defender,
                    }
                }
                "eternum-BattleJoinData" => {
                    let event = BattleJoin::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.joiner,
                    }
                }
                "eternum-BattleLeaveData" => {
                    let event = BattleLeave::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.leaver,
                    }
                }
                "eternum-BattleClaimData" => {
                    let event = BattleClaim::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.previous_owner,
                    }
                }
                "eternum-BattlePillageData" => {
                    let event = BattlePillage::cairo_deserialize(&felts, 0).unwrap();
                    let event_clone = event.clone();
                    Event {
                        event: Box::new(event_clone),
                        identifier: event.pillaged_structure_owner,
                    }
                }
                "eternum-SettleRealmData" => {
                    let event = SettleRealm::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.owner_address,
                    }
                }
                _ => {
                    tracing::info!("Unknown model name: {}", model.name);
                    continue;
                }
            };
            self.processed_event_sender.send(event).await.unwrap();
        }
    }
}
