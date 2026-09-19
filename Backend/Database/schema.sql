-- agent_memory schema (LangGraph Postgres checkpointer + store), dumped from a live database.
-- The backend creates and upgrades these tables itself on startup (saver.setup() / store.setup() in app.py),
-- so this file is a reference and a way to provision the database ahead of time.
--
-- Create the database first:  psql -h localhost -U postgres -c "CREATE DATABASE agent_memory OWNER rohan;"
-- Then apply:                 psql -h localhost -U rohan -d agent_memory -f Database/schema.sql
--
-- The *_migrations rows are included so setup() sees the schema as current and doesn't re-run migrations.

CREATE TABLE public.checkpoint_blobs (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    channel text NOT NULL,
    version text NOT NULL,
    type text NOT NULL,
    blob bytea
);

CREATE TABLE public.checkpoint_migrations (
    v integer NOT NULL
);

CREATE TABLE public.checkpoint_writes (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    task_id text NOT NULL,
    idx integer NOT NULL,
    channel text NOT NULL,
    type text,
    blob bytea NOT NULL,
    task_path text DEFAULT ''::text NOT NULL
);

CREATE TABLE public.checkpoints (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    parent_checkpoint_id text,
    type text,
    checkpoint jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.store (
    prefix text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone,
    ttl_minutes integer
);

CREATE TABLE public.store_migrations (
    v integer NOT NULL
);

ALTER TABLE ONLY public.checkpoint_blobs
    ADD CONSTRAINT checkpoint_blobs_pkey PRIMARY KEY (thread_id, checkpoint_ns, channel, version);

ALTER TABLE ONLY public.checkpoint_migrations
    ADD CONSTRAINT checkpoint_migrations_pkey PRIMARY KEY (v);

ALTER TABLE ONLY public.checkpoint_writes
    ADD CONSTRAINT checkpoint_writes_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx);

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id);

ALTER TABLE ONLY public.store_migrations
    ADD CONSTRAINT store_migrations_pkey PRIMARY KEY (v);

ALTER TABLE ONLY public.store
    ADD CONSTRAINT store_pkey PRIMARY KEY (prefix, key);

CREATE INDEX checkpoint_blobs_thread_id_idx ON public.checkpoint_blobs USING btree (thread_id);

CREATE INDEX checkpoint_writes_thread_id_idx ON public.checkpoint_writes USING btree (thread_id);

CREATE INDEX checkpoints_thread_id_idx ON public.checkpoints USING btree (thread_id);

CREATE INDEX idx_store_expires_at ON public.store USING btree (expires_at) WHERE (expires_at IS NOT NULL);

CREATE INDEX store_prefix_idx ON public.store USING btree (prefix text_pattern_ops);

INSERT INTO public.checkpoint_migrations VALUES (0);
INSERT INTO public.checkpoint_migrations VALUES (1);
INSERT INTO public.checkpoint_migrations VALUES (2);
INSERT INTO public.checkpoint_migrations VALUES (3);
INSERT INTO public.checkpoint_migrations VALUES (4);
INSERT INTO public.checkpoint_migrations VALUES (5);
INSERT INTO public.checkpoint_migrations VALUES (6);
INSERT INTO public.checkpoint_migrations VALUES (7);
INSERT INTO public.checkpoint_migrations VALUES (8);
INSERT INTO public.checkpoint_migrations VALUES (9);
INSERT INTO public.store_migrations VALUES (0);
INSERT INTO public.store_migrations VALUES (1);
INSERT INTO public.store_migrations VALUES (2);
INSERT INTO public.store_migrations VALUES (3);
