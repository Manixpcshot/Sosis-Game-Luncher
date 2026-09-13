# Database

Sosis Launcher persists everything with **SQLite** (`better-sqlite3`) by default.
The database file lives in the per-user data directory, never in the repository:

```
%APPDATA%/Sosis Launcher/database/sosis-launcher.db      (Windows)
~/.config/sosis-launcher/database/sosis-launcher.db      (Linux dev)
```

- `schema.sql` in this folder documents the tables (games, sessions, settings,
  secrets, meta). The schema is created/migrated automatically on boot.
- If the native SQLite module cannot be loaded (for example a cross-built
  package without a matching prebuild) the StorageManager transparently falls
  back to an atomic **JSON** store with the same interface — the app keeps
  working and Settings → Storage shows which backend is active.
- A corrupted database is renamed to `*.corrupt-<timestamp>` and rebuilt instead
  of crashing the launcher; a toast/notice informs the user.
- `secrets` holds only ciphertext (API keys). Plaintext never touches disk.
