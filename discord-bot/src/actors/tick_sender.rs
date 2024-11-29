use std::num::NonZero;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serenity::all::{ChannelId, CreateEmbed, CreateEmbedFooter, CreateMessage};
use starknet_crypto::Felt;
use tokio::sync::mpsc;
use torii_grpc::types::{Clause, KeysClause, PatternMatching, Query};

use crate::constants::{ETERNUM_URL, TICK_ARMIES_ID, WORLD_CONFIG_ID};
use crate::types::{Config, DiscordMessage};

pub struct TickSender<'a> {
    message_sender: &'a mpsc::Sender<DiscordMessage>,
    channel_id: NonZero<u64>,
    torii_client: torii_client::client::Client,
}

impl<'a> TickSender<'a> {
    pub async fn new(
        config: &'a Config,
        message_sender: &'a mpsc::Sender<DiscordMessage>,
    ) -> eyre::Result<Self> {
        let client = torii_client::client::Client::new(
            config.torii_url.clone(),
            config.node_url.clone(),
            config.torii_relay_url.clone(),
            Felt::from_hex_unchecked(&config.world_address.clone()),
        )
        .await?;

        Ok(Self {
            message_sender,
            channel_id: config.channel_id,
            torii_client: client,
        })
    }

    pub async fn run(&mut self) {
        let tick_interval_in_seconds = self
            .torii_client
            .entities(Query {
                clause: Some(Clause::Keys(KeysClause {
                    keys: vec![
                        Some(Felt::from_hex(WORLD_CONFIG_ID).unwrap()),
                        Some(Felt::from_hex(TICK_ARMIES_ID).unwrap()),
                    ],
                    pattern_matching: PatternMatching::FixedLen,
                    models: vec!["s0_eternum-TickConfig".to_string()],
                })),
                limit: 1,
                offset: 0,
                dont_include_hashed_keys: false,
            })
            .await
            .expect("Failed to get tick interval in seconds");

        let entity = tick_interval_in_seconds
            .first()
            .expect("No tick interval in seconds found");

        let tick_interval_in_seconds = entity
            .models
            .iter()
            .find(|model| model.name == "s0_eternum-TickConfig")
            .expect("Tick interval in seconds not found")
            .children
            .iter()
            .find(|child| child.name == "tick_interval_in_seconds")
            .expect("Tick interval in seconds not found")
            .ty
            .as_primitive()
            .expect("Tick interval in seconds is not a primitive")
            .as_u64()
            .expect("Tick interval in seconds is not a u64");

        let mut sleep_time = tick_interval_in_seconds
            - (SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
                % tick_interval_in_seconds);

        loop {
            tokio::time::sleep(Duration::from_secs(sleep_time)).await;

            let discord_message = self.create_timestamp_message().await;
            self.message_sender.send(discord_message).await.unwrap();

            sleep_time = tick_interval_in_seconds;
        }
    }

    async fn create_timestamp_message(&self) -> DiscordMessage {
        let footer = CreateEmbedFooter::new(ETERNUM_URL);
        let embed = CreateEmbed::new()
            .title("A gong sound has echoed through Eternum, a new tick has passed")
            .footer(footer)
            .color(poise::serenity_prelude::Color::BLITZ_BLUE);

        let content = CreateMessage::new()
            .content("@everyone")
            .embed(embed.clone());

        DiscordMessage::ChannelMessage {
            channel_id: ChannelId::from(self.channel_id),
            content,
        }
    }
}
