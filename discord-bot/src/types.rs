use std::num::NonZero;

use eyre::OptionExt;
use serde::Deserialize;
use serenity::{all::CreateMessage, model::id::ChannelId};
use shuttle_runtime::SecretStore;
use sqlx::prelude::FromRow;
use starknet_crypto::Felt;

use crate::events::ToDiscordMessage;

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
pub struct Event {
    pub event: Box<dyn ToDiscordMessage>,
    pub identifier: Felt,
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
