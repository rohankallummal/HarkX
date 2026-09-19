"use client";

import { useEffect, useRef, useState } from "react";
import { focusRing, formatSize, Icon, primaryButton, RemoveButton, secondaryButton, stepBody } from "./ui";

// ponytail: backend address is fixed to the local dev server; read it from an env var once it's deployed
export const API = "http://localhost:8000";

type Stage = "analyzing" | "building" | "testing" | "packaging";
type Ask = { type: "question"; question: string; options: string[] } | { type: "file_request"; description: string };
type Snapshot = { status: "running" | "waiting" | "done" | "failed"; stage: Stage; ask: Ask | null; error: string | null };

// Each stage has its own animation, so the card shows how far the agent has got.
const stages: Record<Stage, { animation: string; label: string }> = {
  analyzing: { animation: "loading", label: "Understanding the skill" },
  building: { animation: "loading-3d-1", label: "Writing the integration" },
  testing: { animation: "loading-3d-2", label: "Testing it against the skill" },
  packaging: { animation: "loading-3d-3", label: "Packaging your download" },
};

const row = `group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-gray-300 transition-colors hover:border-white/25 hover:text-white ${focusRing}`;
const badge = "grid size-7 shrink-0 place-items-center rounded-full border border-white/15 text-xs text-gray-400 group-hover:text-white";

function Lottie({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let animation: { destroy(): void } | undefined;
    let cancelled = false;
    // lottie-web touches `document` on import, so it only loads in the browser
    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !ref.current) return;
      animation = lottie.loadAnimation({ container: ref.current, path: `/animations/${name}.json`, renderer: "svg", loop: true, autoplay: true });
    });
    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [name]);
  return <div ref={ref} aria-hidden="true" className="mt-4 size-36" />;
}

function Question({ ask, onAnswer }: { ask: Extract<Ask, { type: "question" }>; onAnswer: (answer: string) => void }) {
  const [custom, setCustom] = useState<string | null>(null);
  return (
    <>
      <h2 className="text-balance text-xl font-bold tracking-tight">{ask.question}</h2>
      <div className="mt-6 flex w-full flex-col gap-2">
        {ask.options.map((option, i) => (
          <button key={option} onClick={() => onAnswer(option)} className={row}>
            <span className={badge}>{i + 1}</span>
            {option}
          </button>
        ))}
        {custom === null ? (
          <button onClick={() => setCustom("")} className={row}>
            <span className={badge}>
              <Icon className="size-3.5">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </Icon>
            </span>
            Something else
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAnswer(custom.trim());
            }}
            className="relative"
          >
            <input
              aria-label="Your answer"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setCustom(null)}
              placeholder="Type your answer"
              autoFocus
              className="h-11 w-full rounded-xl border border-white/15 bg-transparent pl-4 pr-12 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-harkx-teal"
            />
            <button
              type="submit"
              disabled={!custom.trim()}
              aria-label="Send answer"
              className={`absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg bg-white text-black transition-opacity disabled:pointer-events-none disabled:opacity-0 ${focusRing}`}
            >
              <Icon className="size-4">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </Icon>
            </button>
          </form>
        )}
      </div>
    </>
  );
}

function FileRequest({ description, onSend }: { description: string; onSend: (files: File[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <>
      <h2 className="text-balance text-xl font-bold tracking-tight">Files needed</h2>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
      <div className="mt-6 flex w-full flex-col gap-2">
        {files.map((file) => (
          <div key={file.name} className="flex items-center gap-3 rounded-xl border border-white/15 p-2.5 text-left">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{file.name}</span>
              <span className="block text-[11px] text-gray-400">{formatSize(file.size)}</span>
            </span>
            <RemoveButton name={file.name} onClick={() => setFiles((prev) => prev.filter((f) => f !== file))} />
          </div>
        ))}
        <label className={`${row} justify-center border-dashed has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-harkx-teal`}>
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              setFiles((prev) => [...prev, ...picked.filter((p) => !prev.some((f) => f.name === p.name))]);
            }}
          />
          Choose files
        </label>
      </div>
      <button onClick={() => onSend(files)} disabled={!files.length} className={`mt-4 ${primaryButton}`}>
        Send files
      </button>
      <button onClick={() => onSend([])} className="mt-3 cursor-pointer text-xs text-gray-400 transition-colors hover:text-white">
        Continue without them
      </button>
    </>
  );
}

export default function Build({ id, onRestart }: { id: string; onRestart: () => void }) {
  const [snap, setSnap] = useState<Snapshot>({ status: "running", stage: "analyzing", ask: null, error: null });

  useEffect(() => {
    const events = new EventSource(`${API}/builds/${id}/events`);
    events.onmessage = (e) => {
      const next: Snapshot = JSON.parse(e.data);
      setSnap(next);
      if (next.status === "done" || next.status === "failed") events.close();
    };
    // the browser retries dropped connections itself; it only gives up when the server refuses the build
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED)
        setSnap((s) => ({ ...s, status: "failed", error: "Lost track of the build — the server may have restarted." }));
    };
    return () => events.close();
  }, [id]);

  // Show the building view straight away; the next snapshot corrects it if the server refused.
  const reply = (init: RequestInit & { path: string }) => {
    setSnap((s) => ({ ...s, status: "running", ask: null }));
    fetch(`${API}/builds/${id}/${init.path}`, init).catch(() =>
      setSnap((s) => ({ ...s, status: "failed", error: "Couldn't reach the build server." })),
    );
  };

  return (
    <div className={stepBody}>
      {snap.status === "failed" ? (
        <>
          <span className="grid size-12 place-items-center rounded-full bg-red-500/15 text-red-400">
            <Icon className="size-6">
              <path d="M18 6 6 18M6 6l12 12" />
            </Icon>
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">Build failed</h2>
          <p role="alert" className="mt-2 text-sm text-gray-400">
            {snap.error}
          </p>
          <button onClick={onRestart} className={`mt-6 ${secondaryButton}`}>
            Try again
          </button>
        </>
      ) : snap.status === "done" ? (
        <>
          <span className="grid size-12 place-items-center rounded-full bg-harkx-teal/15 text-harkx-teal">
            <Icon className="size-6">
              <path d="m4.5 12.5 5 5 10-11" />
            </Icon>
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">Integration ready</h2>
          <p className="mt-2 text-sm text-gray-400">Built, tested and packaged as an MCP server.</p>
          <a href={`${API}/builds/${id}/download`} download className={`mt-6 grid place-items-center ${primaryButton}`}>
            Download integration
          </a>
          <button onClick={onRestart} className={`mt-3 ${secondaryButton}`}>
            Build another
          </button>
        </>
      ) : snap.status === "waiting" && snap.ask?.type === "question" ? (
        <Question ask={snap.ask} onAnswer={(answer) => reply({ path: "answer", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) })} />
      ) : snap.status === "waiting" && snap.ask?.type === "file_request" ? (
        <FileRequest
          description={snap.ask.description}
          onSend={(files) => {
            const body = new FormData();
            files.forEach((f) => body.append("files", f));
            reply({ path: "files", method: "POST", body });
          }}
        />
      ) : (
        <>
          <h2 className="text-2xl font-bold tracking-tight">
            <span className="shiny-text">Building</span>
          </h2>
          <p aria-live="polite" className="mt-2 text-sm text-gray-400">
            {stages[snap.stage].label}
          </p>
          <Lottie name={stages[snap.stage].animation} />
        </>
      )}
    </div>
  );
}
