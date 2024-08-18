-- migrations/20230101000000_create_users_table.sql
-- Add migration script here
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address VARCHAR(42) UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    discord VARCHAR(255),
    telegram VARCHAR(255),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create a trigger to update the updated_at column
CREATE TRIGGER update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;