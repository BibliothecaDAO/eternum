mod commands;
mod types;
use ::serenity::Client;
use anyhow::Context as _;
use serenity::{
    all::{GatewayIntents, Http},
    futures::StreamExt,
};
use shuttle_runtime::SecretStore;
use sqlx::{Executor, PgPool};
use std::sync::Arc;
use tokio::sync::mpsc;

type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;

use starknet_crypto::Felt;
use torii_client::client::Client as ToriiClient;

use torii_grpc::types::{EntityKeysClause, KeysClause};

use crate::types::{process_event, Config, EventHandler, MessageDispatcher};

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

async fn setup_torii_client(
    token: String,
    database: PgPool,
    secret_store: SecretStore,
) -> eyre::Result<()> {
    println!("Heyyyyyyyyy");
    let config = Config::from_secrets(secret_store)?;
    println!("1");

    tokio::spawn(async move {
        println!("Heyyyyyyyyy 2222");
        println!("Setting up Torii client");
        let client = ToriiClient::new(
            config.torii_url,
            config.node_url,
            config.torii_relay_url,
            Felt::from_hex_unchecked(&config.world_address),
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
            http: Arc::new(Http::new(&token)),
            message_receiver,
        };

        tokio::spawn(async move {
            while let Some(event) = event_receiver.recv().await {
                process_event(event, &database, &message_sender).await;
            }
        });

        tokio::spawn(async move {
            message_dispatcher.run().await;
        });

        while let Some(Ok((_, entity))) = rcv.next().await {
            event_handler.handle_event(entity).await;
        }
    });

    println!("Torii client setup task spawned");

    Ok(())
}

#[shuttle_runtime::main]
async fn main(
    #[shuttle_shared_db::Postgres] pool: PgPool,
    #[shuttle_runtime::Secrets] secret_store: SecretStore,
) -> shuttle_serenity::ShuttleSerenity {
    // Run the schema migration
    pool.execute(include_str!(
        "../migrations/20240818171830_create_users_table.sql"
    ))
    .await
    .context("failed to run migrations")?;

    let secret = secret_store.get("DISCORD_TOKEN").unwrap();

    let token = secret.clone();

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
                setup_torii_client(token.clone(), pool.clone(), secret_store.clone()).await;
                Ok(Data {
                    database: pool.clone(),
                })
            })
        })
        .build();

    let client = Client::builder(secret, intents)
        .framework(framework)
        .await
        .expect("Failed to build client");

    Ok(client.into())
}
