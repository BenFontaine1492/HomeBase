//! Helpers shared by the native unit tests (compiled for tests only).

use std::fs;
use std::future::Future;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::{migrations, DATABASE_URL};

pub(crate) type Pool = sqlx::Pool<sqlx::Sqlite>;

pub(crate) fn run<F: Future>(future: F) -> F::Output {
    tauri::async_runtime::block_on(future)
}

/// A fresh, empty folder that is deleted again when the test ends.
pub(crate) struct TestDir(pub(crate) PathBuf);

impl TestDir {
    pub(crate) fn new() -> Self {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let name = format!("homebase-test-{}-{}", std::process::id(), COUNTER.fetch_add(1, Ordering::Relaxed));
        let path = std::env::temp_dir().join(name);
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }

    pub(crate) fn path(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for TestDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// Registers `pool` as the live database, like the SQL plugin does at startup.
pub(crate) async fn instances_with(pool: Pool) -> DbInstances {
    let instances = DbInstances::default();
    instances.0.write().await.insert(DATABASE_URL.to_string(), DbPool::Sqlite(pool));
    instances
}

/// A migrated in-memory database registered as the live one.
/// One connection only: every connection to `:memory:` is a separate database.
pub(crate) async fn memory_database() -> (DbInstances, Pool) {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(SqliteConnectOptions::new().in_memory(true))
        .await
        .unwrap();
    for migration in migrations::all() {
        sqlx::raw_sql(migration.sql).execute(&pool).await.unwrap();
    }
    (instances_with(pool.clone()).await, pool)
}
