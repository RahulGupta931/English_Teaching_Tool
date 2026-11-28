"""One-off: copy the old SQLite database (data.db) into the Postgres database at DATABASE_URL.

    .venv\\Scripts\\python migrate_sqlite_to_postgres.py [path\\to\\data.db]

Creates the tables, then copies every row. Refuses to run if Postgres already has users, so it can't overwrite live data.
"""
import os
import sqlite3
import sys

from app import db

# Parents before children, so foreign keys are satisfied as rows arrive.
TABLES = ["plans", "users", "activities", "mistakes", "usage", "roleplay_sessions", "payments", "daily_word_games",
          "word_chain_games", "twisters", "quiz_sessions"]


def main(path: str) -> None:
    src = sqlite3.connect(path)
    src.row_factory = sqlite3.Row
    db.init()
    with db.connect() as con:
        if con.execute("select 1 from users limit 1").fetchone():
            sys.exit("Postgres already has users; not copying over them.")
        con.execute(f"truncate {', '.join(TABLES)} restart identity cascade")  # drops the seeded plans; data.db has its own
        for table in TABLES:
            if not src.execute("select 1 from sqlite_master where type = 'table' and name = ?", (table,)).fetchone():
                continue
            target = {r["column_name"] for r in con.execute(
                "select column_name from information_schema.columns where table_schema = current_schema() and table_name = ?",
                (table,))}
            cols = [r["name"] for r in src.execute(f"pragma table_info({table})") if r["name"] in target]
            rows = [tuple(r[c] for c in cols) for r in src.execute(f"select {', '.join(cols)} from {table}")]
            if rows:
                con.executemany(f"insert into {table} ({', '.join(cols)}) values ({', '.join('?' * len(cols))})", rows)
            if "id" in cols:  # continue new ids after the copied ones
                con.execute(f"select setval(pg_get_serial_sequence('{table}', 'id'), coalesce((select max(id) from {table}), 0) + 1, false)")
            print(f"{table}: {len(rows)} rows")


if __name__ == "__main__":
    if not os.environ.get("DATABASE_URL"):
        sys.exit("Set DATABASE_URL first (e.g. run with --env-file, or set it in this shell).")
    main(sys.argv[1] if len(sys.argv) > 1 else "data.db")
