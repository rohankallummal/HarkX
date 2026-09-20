BEGIN;

DROP TABLE IF EXISTS
    public.checkpoint_blobs,
    public.checkpoint_writes,
    public.checkpoints,
    public.checkpoint_migrations,
    public.store,
    public.store_migrations
CASCADE;

CREATE TABLE public.checkpoint_blobs (
    thread_id text NOT NULL,
    checkpoint_ns text NOT NULL DEFAULT '',
    channel text NOT NULL,
    version text NOT NULL,
    type text NOT NULL,
    blob bytea,
    PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

CREATE TABLE public.checkpoint_migrations (
    v integer PRIMARY KEY
);

CREATE TABLE public.checkpoint_writes (
    thread_id text NOT NULL,
    checkpoint_ns text NOT NULL DEFAULT '',
    checkpoint_id text NOT NULL,
    task_id text NOT NULL,
    idx integer NOT NULL,
    channel text NOT NULL,
    type text,
    blob bytea NOT NULL,
    task_path text NOT NULL DEFAULT '',
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

CREATE TABLE public.checkpoints (
    thread_id text NOT NULL,
    checkpoint_ns text NOT NULL DEFAULT '',
    checkpoint_id text NOT NULL,
    parent_checkpoint_id text,
    type text,
    checkpoint jsonb NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE TABLE public.store (
    prefix text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamptz,
    ttl_minutes integer,
    PRIMARY KEY (prefix, key)
);

CREATE TABLE public.store_migrations (
    v integer PRIMARY KEY
);

CREATE INDEX checkpoint_blobs_thread_id_idx ON public.checkpoint_blobs (thread_id);
CREATE INDEX checkpoint_writes_thread_id_idx ON public.checkpoint_writes (thread_id);
CREATE INDEX checkpoints_thread_id_idx ON public.checkpoints (thread_id);
CREATE INDEX store_prefix_idx ON public.store (prefix text_pattern_ops);
CREATE INDEX idx_store_expires_at ON public.store (expires_at) WHERE expires_at IS NOT NULL;

INSERT INTO public.checkpoint_migrations SELECT generate_series(0, 9);
INSERT INTO public.store_migrations SELECT generate_series(0, 3);

COMMIT;