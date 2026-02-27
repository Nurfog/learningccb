use sqlx::{MySql, Pool};
use std::env;

pub type MySqlPool = Pool<MySql>;

pub async fn init_mysql_pool() -> Option<MySqlPool> {
    if let Ok(url) = env::var("MYSQL_DATABASE_URL") {
        match sqlx::mysql::MySqlPoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await
        {
            Ok(pool) => {
                tracing::info!("Connected to external MySQL database");
                Some(pool)
            }
            Err(e) => {
                tracing::error!("Failed to connect to external MySQL database: {}", e);
                None
            }
        }
    } else {
        tracing::info!("MYSQL_DATABASE_URL not set, skipping external database integration");
        None
    }
}
