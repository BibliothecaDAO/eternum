use cainome_cairo_serde::CairoSerde;
use dojo_types::schema::Ty;
use serenity::futures::StreamExt;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::sleep;

use starknet_crypto::Felt;
use torii_grpc::types::schema::Entity;

use torii_grpc::types::{EntityKeysClause, KeysClause, PatternMatching};

use crate::events::hyperstructure_finished::HyperstructureFinished;
use crate::events::hyperstructure_started::HyperstructureStarted;
use crate::{
    events::{
        battle_claim::BattleClaim, battle_join::BattleJoin, battle_leave::BattleLeave,
        battle_pillage::BattlePillage, battle_start::BattleStart, game_ended::GameEnded,
        settle_realm::SettleRealm,
    },
    types::{Config, Event},
};

const TORII_SUBSCRIPTION_MODELS: [&str; 9] = [
    "s0_eternum-BattleClaimData",
    "s0_eternum-BattleJoinData",
    "s0_eternum-BattleLeaveData",
    "s0_eternum-BattlePillageData",
    "s0_eternum-BattleStartData",
    "s0_eternum-SettleRealmData",
    "s0_eternum-GameEnded",
    "s0_eternum-HyperstructureFinished",
    "s0_eternum-HyperstructureStarted",
];

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
            let rcv = self
                .client
                .on_event_message_updated(
                    vec![EntityKeysClause::Keys(KeysClause {
                        keys: vec![],
                        pattern_matching: PatternMatching::VariableLen,
                        models: TORII_SUBSCRIPTION_MODELS
                            .iter()
                            .map(|s| s.to_string())
                            .collect(),
                    })],
                    false,
                )
                .await;

            match rcv {
                Ok(mut rcv) => {
                    backoff = Duration::from_secs(1);

                    loop {
                        match rcv.next().await {
                            Some(result) => {
                                if let Ok((_, entity)) = result {
                                    tracing::info!("Received event");
                                    self.treat_received_torii_event(entity).await;
                                } else {
                                    tracing::warn!(
                                        "Received invalid data from torii, reconnecting"
                                    );
                                    break;
                                }
                            }
                            None => {
                                tracing::warn!("Stream returned an error, reconnecting");
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Subscription failed: {:?}", e);
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

            let event = match model.name.as_str() {
                "s0_eternum-BattleStartData" => {
                    let event = BattleStart::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.defender,
                    }
                }
                "s0_eternum-BattleJoinData" => {
                    let event = BattleJoin::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.joiner,
                    }
                }
                "s0_eternum-BattleLeaveData" => {
                    let event = BattleLeave::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.leaver,
                    }
                }
                "s0_eternum-BattleClaimData" => {
                    let event = BattleClaim::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.claimee_address,
                    }
                }
                "s0_eternum-BattlePillageData" => {
                    let event = BattlePillage::cairo_deserialize(&felts, 0).unwrap();
                    let event_clone = event.clone();
                    Event {
                        event: Box::new(event_clone),
                        identifier: event.pillaged_structure_owner,
                    }
                }
                "s0_eternum-SettleRealmData" => {
                    let event = SettleRealm::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.owner_address,
                    }
                }
                "s0_eternum-GameEnded" => {
                    let event = GameEnded::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.winner_address,
                    }
                }
                "s0_eternum-HyperstructureFinished" => {
                    let event = HyperstructureFinished::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.hyperstructure_owner_name,
                    }
                }
                "s0_eternum-HyperstructureStarted" => {
                    let event = HyperstructureStarted::cairo_deserialize(&felts, 0).unwrap();
                    Event {
                        event: Box::new(event),
                        identifier: event.creator_address_name,
                    }
                }
                _ => {
                    tracing::warn!("Unknown model name: {}", model.name);
                    continue;
                }
            };
            self.processed_event_sender.send(event).await.unwrap();
        }
    }
}
