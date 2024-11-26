use crate::actors::discord_message_sender::DiscordMessageSender;
use crate::actors::torii_client_subscriber::ToriiClientSubscriber;
use crate::actors::{discord_message_creator::DiscordMessageCreator, tick_sender::TickSender};
use crate::commands;
use crate::types::Config;
use serenity::all::{Client, GatewayIntents, Http};
use shuttle_serenity::ShuttleSerenity;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::mpsc;

pub type Error = Box<dyn std::error::Error + Send + Sync>;
pub type Context<'a> = poise::Context<'a, PoiseContextData, Error>;

pub struct PoiseContextData {
    pub database: PgPool,
}

pub async fn launch_services(config: Config, pool: PgPool) -> ShuttleSerenity {
    launch_internal_services(pool.clone(), config.clone()).await;

    launch_discord_service(config, pool).await
}

async fn launch_internal_services(database: PgPool, config: Config) {
    let (processed_event_sender, processed_event_receiver) = mpsc::channel(100);
    let (message_sender, message_receiver) = mpsc::channel(100);

    let config_clone = config.clone();
    tokio::spawn(async move {
        tracing::info!("Starting Torii client subscriber");
        let torii_client_subscriber =
            ToriiClientSubscriber::new(config_clone, processed_event_sender)
                .await
                .expect("Failed to create Torii client subscriber");
        torii_client_subscriber.subscribe().await;
    });

    let config_clone = config.clone();
    let message_sender_clone = message_sender.clone();
    tokio::spawn(async move {
        tracing::info!("Starting event processor");
        let mut processor = DiscordMessageCreator::new(
            &database,
            &message_sender_clone,
            config_clone.channel_id,
            processed_event_receiver,
        );
        processor.run().await;
    });

    let config_clone = config.clone();
    tokio::spawn(async move {
        tracing::info!("Starting message dispatcher");
        let mut discord_message_sender = DiscordMessageSender::new(
            Arc::new(Http::new(&config_clone.discord_token.clone())),
            message_receiver,
        );
        discord_message_sender.run().await;
    });

    let config_clone = config.clone();
    let message_sender_clone = message_sender.clone();
    tokio::spawn(async move {
        tracing::info!("Starting tick sender");
        let mut tick_sender = TickSender::new(&config_clone, &message_sender_clone)
            .await
            .expect("Failed to create tick sender");
        tick_sender.run().await;
    });
}

async fn launch_discord_service(config: Config, pool: PgPool) -> ShuttleSerenity {
    let intents = GatewayIntents::non_privileged();

    let framework = poise::Framework::builder()
        .options(poise::FrameworkOptions {
            commands: vec![
                commands::add_user::add_user(),
                commands::update_user::update_user(),
                commands::get_user::get_user(),
            ],
            ..Default::default()
        })
        .setup(|ctx, _ready, framework| {
            Box::pin(async move {
                poise::builtins::register_globally(ctx, &framework.options().commands).await?;
                Ok(PoiseContextData {
                    database: pool.clone(),
                })
            })
        })
        .build();

    let client = Client::builder(config.discord_token.clone(), intents)
        .framework(framework)
        .await
        .map_err(shuttle_runtime::CustomError::new)?;

    Ok(client.into())
}
