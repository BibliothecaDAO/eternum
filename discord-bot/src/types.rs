use std::{num::NonZero, sync::Arc};

use cainome_cairo_serde::CairoSerde;
use dojo_types::schema::Ty;
use eyre::OptionExt;
use serde::Deserialize;
use serenity::{
    all::{CreateMessage, UserId},
    model::id::ChannelId,
};
use shuttle_runtime::SecretStore;
use sqlx::prelude::FromRow;
use tokio::sync::mpsc;
use torii_grpc::types::schema::Entity;

use crate::events::{
    battle_claim::BattleClaim, battle_join::BattleJoin, battle_leave::BattleLeave,
    battle_pillage::BattlePillage, battle_start::BattleStart, settle_realm::SettleRealm,
    ToDiscordMessage,
};

#[allow(dead_code)]
pub enum GameEvent {
    BattleStart(BattleStart),
    BattleJoin(BattleJoin),
    BattleLeave(BattleLeave),
    BattleClaim(BattleClaim),
    BattlePillage(BattlePillage),
    SettleRealm(SettleRealm),
}

impl ToDiscordMessage for GameEvent {
    fn to_discord_message(&mut self, msg_type: DiscordMessageType) -> DiscordMessage {
        match self {
            GameEvent::BattleStart(event) => event.to_discord_message(msg_type),
            GameEvent::BattleJoin(event) => event.to_discord_message(msg_type),
            GameEvent::BattleLeave(event) => event.to_discord_message(msg_type),
            GameEvent::BattleClaim(event) => event.to_discord_message(msg_type),
            GameEvent::BattlePillage(event) => event.to_discord_message(msg_type),
            GameEvent::SettleRealm(event) => event.to_discord_message(msg_type),
        }
    }

    fn should_send_in_channel_if_no_user_found(&self) -> bool {
        match self {
            GameEvent::BattleStart(e) => e.should_send_in_channel_if_no_user_found(),
            GameEvent::BattleJoin(e) => e.should_send_in_channel_if_no_user_found(),
            GameEvent::BattleLeave(e) => e.should_send_in_channel_if_no_user_found(),
            GameEvent::BattleClaim(e) => e.should_send_in_channel_if_no_user_found(),
            GameEvent::BattlePillage(e) => e.should_send_in_channel_if_no_user_found(),
            GameEvent::SettleRealm(e) => e.should_send_in_channel_if_no_user_found(),
        }
    }
}

pub enum DiscordMessageType {
    DirectMessage(u64),
    ChannelMessage(NonZero<u64>),
}

#[derive(Debug, Clone)]
pub enum DiscordMessage {
    DirectMessage {
        user_id: u64,
        content: CreateMessage,
    },
    ChannelMessage {
        channel_id: ChannelId,
        content: CreateMessage,
    },
}

pub struct MessageDispatcher {
    pub http: Arc<serenity::all::Http>,
    pub message_receiver: mpsc::Receiver<DiscordMessage>,
}

impl MessageDispatcher {
    pub async fn run(&mut self) {
        while let Some(message) = self.message_receiver.recv().await {
            tracing::info!("Received message through channel");
            if let Err(e) = self.send_message(message).await {
                tracing::warn!("Failed to send message: {:?}", e);
            }
        }
    }

    pub async fn send_message(&self, message: DiscordMessage) -> Result<(), serenity::Error> {
        match message {
            DiscordMessage::DirectMessage { user_id, content } => {
                let user = UserId::new(user_id);
                match user.create_dm_channel(&self.http).await {
                    Ok(channel) => {
                        tracing::info!("DM channel created for user {}", user_id);

                        channel.send_message(&self.http, content).await?;

                        tracing::info!("DM sent to user {}", user_id);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to create DM channel for user {}: {:?}", user_id, e);
                        return Err(e);
                    }
                }
            }
            DiscordMessage::ChannelMessage {
                channel_id,
                content,
            } => {
                channel_id.send_message(&self.http, content).await?;
                tracing::info!("Message sent to channel {}", channel_id);
            }
        }
        Ok(())
    }
}

pub struct EventHandler {
    pub processed_event_sender: mpsc::Sender<GameEvent>,
}

impl EventHandler {
    pub async fn handle_event(&self, entity: Entity) {
        for model in entity.models {
            let ty = Ty::Struct(model.clone());

            let felts = ty.serialize().unwrap();

            tracing::info!("FELTS: {:?}", felts);
            tracing::info!("MODEL NAME: {:?}", model.name);

            let event = match model.name.as_str() {
                "eternum-BattleStartData" => {
                    GameEvent::BattleStart(BattleStart::cairo_deserialize(&felts, 0).unwrap())
                }
                "eternum-BattleJoinData" => {
                    GameEvent::BattleJoin(BattleJoin::cairo_deserialize(&felts, 0).unwrap())
                }
                "eternum-BattleLeaveData" => {
                    GameEvent::BattleLeave(BattleLeave::cairo_deserialize(&felts, 0).unwrap())
                }
                "eternum-BattleClaimData" => {
                    GameEvent::BattleClaim(BattleClaim::cairo_deserialize(&felts, 0).unwrap())
                }
                "eternum-BattlePillageData" => {
                    GameEvent::BattlePillage(BattlePillage::cairo_deserialize(&felts, 0).unwrap())
                }
                "eternum-SettleRealmData" => {
                    GameEvent::SettleRealm(SettleRealm::cairo_deserialize(&felts, 0).unwrap())
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

#[derive(Deserialize, Debug, Clone)]
pub struct Config {
    pub discord_token: String,
    pub channel_id: NonZero<u64>,
    pub torii_url: String,
    pub node_url: String,
    pub torii_relay_url: String,
    pub world_address: String,
}

impl Config {
    pub fn from_secrets(secret_store: SecretStore) -> eyre::Result<Self> {
        let discord_token = secret_store.get("DISCORD_TOKEN").unwrap();
        let channel_id = NonZero::new(
            secret_store
                .get("CHANNEL_ID")
                .ok_or_eyre("channel id not set")?
                .parse::<u64>()?,
        )
        .ok_or_eyre("Failed to convert string to non zero")?;
        let torii_url = secret_store.get("TORII_URL").unwrap();
        let node_url = secret_store.get("NODE_URL").unwrap();
        let torii_relay_url = secret_store.get("TORII_RELAY_URL").unwrap();
        let world_address = secret_store.get("WORLD_ADDRESS").unwrap();

        let config = Config {
            discord_token,
            channel_id,
            torii_url,
            node_url,
            torii_relay_url,
            world_address,
        };

        Ok(config)
    }
}

#[derive(FromRow)]
pub struct User {
    pub address: String,
    pub discord: Option<String>,
    pub telegram: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
