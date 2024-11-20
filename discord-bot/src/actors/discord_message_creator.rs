use std::num::NonZero;

use sqlx::PgPool;
use tokio::sync::mpsc;

use crate::check_user_in_database;
use crate::types::{DiscordMessage, DiscordMessageType, Event};

pub struct DiscordMessageCreator<'a, 'b> {
    database: &'a PgPool,
    message_sender: &'b mpsc::Sender<DiscordMessage>,
    channel_id: NonZero<u64>,
    process_event_receiver: mpsc::Receiver<Event>,
}

impl<'a, 'b> DiscordMessageCreator<'a, 'b> {
    pub fn new(
        database: &'a PgPool,
        message_sender: &'b mpsc::Sender<DiscordMessage>,
        channel_id: NonZero<u64>,
        process_event_receiver: mpsc::Receiver<Event>,
    ) -> Self {
        Self {
            database,
            message_sender,
            channel_id,
            process_event_receiver,
        }
    }

    pub async fn run(&mut self) {
        while let Some(event) = self.process_event_receiver.recv().await {
            self.process_event(event).await;
        }
    }

    pub async fn process_event(&self, event: Event) {
        let messages = self.create_messages_from_event(event).await;
        self.send_messages(messages).await;
    }

    async fn create_messages_from_event(&self, event: Event) -> Vec<DiscordMessage> {
        let address = event.identifier.to_hex_string();
        let mut inner_event = event.event;

        let mut messages: Vec<DiscordMessage> = vec![];

        if let Ok(Some(Some(discord_id))) = check_user_in_database(self.database, &address).await {
            tracing::info!("User found in the database: {}", discord_id);

            if let Ok(user_id) = discord_id.parse::<u64>() {
                let channel_message = inner_event
                    .to_discord_message(DiscordMessageType::ChannelMessage(self.channel_id));
                messages.push(channel_message.clone());

                let direct_message =
                    inner_event.to_discord_message(DiscordMessageType::DirectMessage(user_id));
                messages.push(direct_message.clone());
            }
        } else if inner_event.should_send_in_channel_if_no_user_found() {
            let channel_message =
                inner_event.to_discord_message(DiscordMessageType::ChannelMessage(self.channel_id));
            messages.push(channel_message.clone());
        }

        messages
    }

    pub async fn send_messages(&self, messages: Vec<DiscordMessage>) {
        for message in messages {
            self.message_sender.send(message).await.unwrap();
        }
    }
}
