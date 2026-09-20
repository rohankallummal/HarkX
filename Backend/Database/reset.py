"""Wipes agent_memory back to empty tables.  Run:  .venv/Scripts/python Database/reset.py

Uses psycopg rather than the psql CLI because Smart App Control blocks psql.exe on this machine.
"""
import pathlib
import psycopg
from dotenv import load_dotenv
import os

here = pathlib.Path(__file__).parent
load_dotenv(here.parent / ".env")

# same connection app.py builds
with psycopg.connect(host="localhost", port=5432, dbname="agent_memory",
                     user="rohan", password=os.environ["PG_PASSWORD"]) as conn:
    conn.execute((here / "reset.sql").read_text())

print("agent_memory reset.")
