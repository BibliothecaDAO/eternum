use std::sync::Arc;

use serenity::all::UserId;
use tokio::sync::mpsc;

use crate::types::DiscordMessage;

pub struct DiscordMessageSender {
    pub http: Arc<serenity::all::Http>,
    pub message_receiver: mpsc::Receiver<DiscordMessage>,
}

impl DiscordMessageSender {
    pub fn new(
        http: Arc<serenity::all::Http>,
        message_receiver: mpsc::Receiver<DiscordMessage>,
    ) -> Self {
        Self {
            http,
            message_receiver,
        }
    }

    pub async fn run(&mut self) {
        while let Some(message) = self.message_receiver.recv().await {
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
            }
        }
        Ok(())
    }
}
