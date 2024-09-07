mod commands;
mod constants;
mod events;
mod types;
use anyhow::Context as _;
use serenity::Client;
use serenity::{
    all::{GatewayIntents, Http},
    futures::StreamExt,
};
use shuttle_runtime::SecretStore;
use sqlx::{Executor, PgPool};
use std::sync::Arc;
use tokio::sync::mpsc;
use types::EventProcessor;

type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;

use starknet_crypto::Felt;
use torii_client::client::Client as ToriiClient;

use torii_grpc::types::{EntityKeysClause, KeysClause};

use crate::types::{Config, EventHandler, MessageDispatcher};

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

async fn setup_torii_client(database: PgPool, config: Config) -> eyre::Result<()> {
    tokio::spawn(async move {
        tracing::info!("Setting up Torii client");
        let client = ToriiClient::new(
            config.torii_url.clone(),
            config.node_url.clone(),
            config.torii_relay_url.clone(),
            Felt::from_hex_unchecked(&config.world_address.clone()),
        )
        .await
        .unwrap();

        let mut rcv = client
            .on_event_message_updated(vec![EntityKeysClause::Keys(KeysClause {
                keys: vec![],
                pattern_matching: torii_grpc::types::PatternMatching::VariableLen,
                models: vec![],
            })])
            .await
            .unwrap();

        let (event_sender, mut event_receiver) = mpsc::channel(100);
        let (message_sender, message_receiver) = mpsc::channel(100);

        let event_handler = EventHandler { event_sender };
        let mut message_dispatcher = MessageDispatcher {
            http: Arc::new(Http::new(&config.discord_token.clone())),
            message_receiver,
        };

        tokio::spawn(async move {
            let processor = EventProcessor::new(&database, &message_sender, config.channel_id);
            while let Some(event) = event_receiver.recv().await {
                processor.process_event(event).await;
            }
        });

        tokio::spawn(async move {
            message_dispatcher.run().await;
        });
        tracing::info!("Everything set up correctly");
        while let Some(Ok((_, entity))) = rcv.next().await {
            event_handler.handle_event(entity).await;
        }
    });

    tracing::info!("Torii client setup task spawned");

    Ok(())
}

#[shuttle_runtime::main]
async fn main(
    #[shuttle_shared_db::Postgres] pool: PgPool,
    #[shuttle_runtime::Secrets] secret_store: SecretStore,
) -> shuttle_serenity::ShuttleSerenity {
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
                setup_torii_client(pool.clone(), config.clone())
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
