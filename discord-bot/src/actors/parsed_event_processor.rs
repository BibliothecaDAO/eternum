use std::num::NonZero;

use sqlx::PgPool;
use tokio::sync::mpsc;

use crate::check_user_in_database;
use crate::events::ToDiscordMessage;
use crate::types::{DiscordMessage, DiscordMessageType, GameEvent};

pub struct ParsedEventProcessor<'a, 'b> {
    database: &'a PgPool,
    message_sender: &'b mpsc::Sender<DiscordMessage>,
    channel_id: NonZero<u64>,
}

impl<'a, 'b> ParsedEventProcessor<'a, 'b> {
    pub fn new(
        database: &'a PgPool,
        message_sender: &'b mpsc::Sender<DiscordMessage>,
        channel_id: NonZero<u64>,
    ) -> Self {
        Self {
            database,
            message_sender,
            channel_id,
        }
    }

    async fn send_messages_for_user(&self, address: &str, event: &mut impl ToDiscordMessage) {
        if let Ok(Some(Some(discord_id))) = check_user_in_database(self.database, address).await {
            tracing::info!("User found in the database: {}", discord_id);
            if let Ok(user_id) = discord_id.parse::<u64>() {
                let channel_message =
                    event.to_discord_message(DiscordMessageType::ChannelMessage(self.channel_id));
                self.message_sender
                    .send(channel_message.clone())
                    .await
                    .unwrap();
                tracing::info!("Sent channel message for user {:?}", channel_message);

                let direct_message =
                    event.to_discord_message(DiscordMessageType::DirectMessage(user_id));
                self.message_sender
                    .send(direct_message.clone())
                    .await
                    .unwrap();
                tracing::info!("Sent direct message to user {:?}", direct_message);
            }
        } else if event.should_send_in_channel_if_no_user_found() {
            let channel_message =
                event.to_discord_message(DiscordMessageType::ChannelMessage(self.channel_id));
            self.message_sender
                .send(channel_message.clone())
                .await
                .unwrap();
        }
    }

    pub async fn process_event(&self, event: GameEvent) {
        match event {
            GameEvent::SettleRealm(mut event) => {
                tracing::info!("Processing SettleRealm event");
                self.send_messages_for_user(&event.owner_address.to_hex_string(), &mut event)
                    .await;
            }
            GameEvent::BattleStart(mut event) => {
                tracing::info!("Processing BattleStart event");
                self.send_messages_for_user(&event.defender.to_hex_string(), &mut event)
                    .await;
            }
            GameEvent::BattleJoin(mut event) => {
                tracing::info!("Processing BattleJoin event");
                self.send_messages_for_user(&event.joiner.to_hex_string(), &mut event)
                    .await;
            }
            GameEvent::BattleLeave(mut event) => {
                tracing::info!("Processing BattleLeave event");
                self.send_messages_for_user(&event.leaver.to_hex_string(), &mut event)
                    .await;
            }
            GameEvent::BattleClaim(mut event) => {
                tracing::info!("Processing BattleClaim event");
                self.send_messages_for_user(&event.previous_owner.to_hex_string(), &mut event)
                    .await;
            }
            GameEvent::BattlePillage(mut event) => {
                tracing::info!("Processing BattlePillage event");
                self.send_messages_for_user(
                    &event.pillaged_structure_owner.to_hex_string(),
                    &mut event,
                )
                .await;
            }
        }
    }
}
