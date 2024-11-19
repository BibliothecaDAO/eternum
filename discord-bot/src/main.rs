mod actors;
mod commands;
mod constants;
mod eternum_enums;
mod events;
mod init;
mod types;
mod utils;

use anyhow::Context as _;
use shuttle_runtime::SecretStore;
use sqlx::{Executor, PgPool};

use crate::init::launch_services;
use crate::types::Config;

async fn check_user_in_database(
    pool: &PgPool,
    address: &str,
) -> Result<Option<Option<String>>, sqlx::Error> {
    sqlx::query_scalar("SELECT discord FROM users WHERE address = $1")
        .bind(address)
        .fetch_optional(pool)
        .await
}

#[shuttle_runtime::main]
async fn main(
    #[shuttle_shared_db::Postgres] pool: PgPool,
    #[shuttle_runtime::Secrets] secret_store: SecretStore,
) -> shuttle_serenity::ShuttleSerenity {
    tracing::info!("Launching Eternum's Discord bot");

    let config = Config::from_secrets(secret_store).expect("Failed to get config");

    // Run the schema migration
    pool.execute(include_str!(
        "../migrations/20240818171830_create_users_table.sql"
    ))
    .await
    .context("failed to run migrations")?;

    let client = launch_services(config, pool)
        .await
        .expect("Failed to setup discord services");

    Ok(client)
}
