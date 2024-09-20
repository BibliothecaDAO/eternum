mod commands;
mod constants;
mod events;
mod subscription;
mod types;
mod utils;

use anyhow::Context as _;
use serenity::all::{GatewayIntents, Http};
use serenity::Client;
use shuttle_runtime::SecretStore;
use sqlx::{Executor, PgPool};
use std::sync::Arc;
use subscription::subscribe_with_reconnection;
use tokio::sync::mpsc;
use types::EventProcessor;

type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;

use crate::types::{Config, MessageDispatcher};

struct Data {
    database: PgPool,
}

async fn check_user_in_database(
    pool: &PgPool,
    address: &str,
) -> Result<Option<Option<String>>, sqlx::Error> {
    sqlx::query_scalar("SELECT discord FROM users WHERE address = $1")
        .bind(address)
        .fetch_optional(pool)
        .await
}

async fn setup_services(database: PgPool, config: Config) -> eyre::Result<()> {
    let (event_sender, mut event_receiver) = mpsc::channel(100);
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
        let processor = EventProcessor::new(&database, &message_sender, config_clone.channel_id);
        while let Some(event) = event_receiver.recv().await {
            processor.process_event(event).await;
        }
    });

    subscribe_with_reconnection(config, event_sender);
    tracing::info!("Torii client setup task spawned");

    Ok(())
}

#[shuttle_runtime::main]
async fn main(
    #[shuttle_shared_db::Postgres] pool: PgPool,
    #[shuttle_runtime::Secrets] secret_store: SecretStore,
) -> shuttle_serenity::ShuttleSerenity {
    tracing::info!("Launching Eternum's Discord bot");

    let config = Config::from_secrets(secret_store).expect("Failed to get config");

    let config_clone = config.clone();

    // Run the schema migration
    pool.execute(include_str!(
        "../migrations/20240818171830_create_users_table.sql"
    ))
    .await
    .context("failed to run migrations")?;

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
                setup_services(pool.clone(), config.clone())
                    .await
                    .expect("Failed to setup torii client");
                Ok(Data {
                    database: pool.clone(),
                })
            })
        })
        .build();

    let client = Client::builder(config_clone.discord_token, intents)
        .framework(framework)
        .await
        .expect("Failed to build client");

    Ok(client.into())
}
