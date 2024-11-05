use crate::actors::parsed_event_processor::ParsedEventProcessor;
use crate::commands;
use crate::subscription::ToriiClient;
use crate::types::{Config, MessageDispatcher};
use serenity::all::{Client, GatewayIntents, Http};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::mpsc;

pub type Error = Box<dyn std::error::Error + Send + Sync>;
pub type Context<'a> = poise::Context<'a, PoiseContextData, Error>;

pub struct PoiseContextData {
    pub database: PgPool,
}

async fn init_inner_services(database: PgPool, config: Config) -> eyre::Result<()> {
    let (processed_event_sender, mut processed_event_receiver) = mpsc::channel(100);
    let (message_sender, message_receiver) = mpsc::channel(100);

    let mut message_dispatcher = MessageDispatcher {
        http: Arc::new(Http::new(&config.discord_token.clone())),
        message_receiver,
    };

    tokio::spawn(async move {
        tracing::info!("Starting message dispatcher");
        message_dispatcher.run().await;
    });

    let config_clone = config.clone();
    tokio::spawn(async move {
        tracing::info!("Starting event processor");
        let processor =
            ParsedEventProcessor::new(&database, &message_sender, config_clone.channel_id);
        while let Some(event) = processed_event_receiver.recv().await {
            processor.process_event(event).await;
        }
    });

    let torii_client = ToriiClient::new(config).await;
    torii_client.subscribe(processed_event_sender);

    tracing::info!("Torii client setup task spawned");

    Ok(())
}

pub async fn init_services(config: Config, pool: PgPool) -> eyre::Result<Client> {
    let intents = GatewayIntents::non_privileged();

    let config_clone = config.clone();

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
                init_inner_services(pool.clone(), config.clone())
                    .await
                    .expect("Failed to setup torii client");
                Ok(PoiseContextData {
                    database: pool.clone(),
                })
            })
        })
        .build();

    let client = Client::builder(config_clone.discord_token.clone(), intents)
        .framework(framework)
        .await
        .expect("Failed to build client");

    Ok(client)
}
