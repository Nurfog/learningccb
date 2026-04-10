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
                tracing::info!("Conectado a la base de datos MySQL externa");
                Some(pool)
            }
            Err(e) => {
                tracing::error!("Error al conectar a la base de datos MySQL externa: {}", e);
                None
            }
        }
    } else {
        tracing::info!("MYSQL_DATABASE_URL no establecida, omitiendo la integración con la base de datos externa");
        None
    }
}
