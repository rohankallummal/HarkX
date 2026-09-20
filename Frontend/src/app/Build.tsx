"use client";

import type { AnimationItem } from "lottie-web";
import { useEffect, useRef, useState } from "react";
import { askBody, focusRing, formatSize, Icon, noScrollbar, primaryButton, RemoveButton, secondaryButton, stepBody } from "./ui";

// ponytail: backend address is fixed to the local dev server; read it from an env var once it's deployed
export const API = "http://localhost:8000";

type Stage = "analyzing" | "building" | "testing" | "packaging";
type Ask = { type: "question"; question: string; options: string[] } | { type: "file_request"; description: string };
type Snapshot = { status: "running" | "waiting" | "done" | "failed"; stage: Stage; ask: Ask | null; error: string | null };

// Each stage has its own animation, so the card shows how far the agent has got.
const stages: Record<Stage, { animation: string; label: string; className?: string }> = {
  analyzing: { animation: "loading", label: "Understanding the skill" },
  building: { animation: "loading-3d-1", label: "Writing the integration" },
  // Both 3d files leave most of their frame transparent, so they read small at the shared size.
  // Scaling paints them bigger without taking up more room — the card stays the height it is at
  // every other stage, and the overflow is empty frame rather than artwork. loading-3d-3 needs the
  // most because its art fills only about a sixth of its canvas.
  testing: { animation: "loading-3d-2", label: "Testing it against the skill", className: "mt-4 size-36 scale-[1.2]" },
  packaging: { animation: "loading-3d-3", label: "Packaging your download", className: "mt-4 size-36 scale-[1.75]" },
};

const row = `group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-gray-300 transition-colors hover:border-white/25 hover:text-white ${focusRing}`;
const badge = "grid size-7 shrink-0 place-items-center rounded-full border border-white/15 text-xs text-gray-400 group-hover:text-white";

function Lottie({ name, loop = true, className = "mt-4 size-36" }: { name: string; loop?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let animation: AnimationItem | undefined;
    let cancelled = false;
    // lottie-web touches `document` on import, so it only loads in the browser
    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !ref.current) return;
      animation = lottie.loadAnimation({ container: ref.current, path: `/animations/${name}.json`, renderer: "svg", loop, autoplay: true });
      // a one-shot animation is a result rather than a progress cue, so reduced motion gets the result
      if (!loop && matchMedia("(prefers-reduced-motion: reduce)").matches)
        animation.addEventListener("DOMLoaded", () => animation?.goToAndStop(animation.totalFrames - 1, true));
    });
    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [name, loop]);
  return <div ref={ref} aria-hidden="true" className={className} />;
}

/**
 * The shell both asks share. The agent writes as much or as little as it likes, so its words are read
 * back as prose — left aligned, one measure wide, capped at a slice of the viewport and scrolled from
 * there — and everything the user has to touch sits below the rule, where it stays put whatever the
 * length above it. Nothing is clamped away: what does not fit scrolls, and `Read the full …` trades
 * the card's width for a proper reading column.
 */
function AskCard({ noun, state, text, children }: { noun: string; state: string; text: string; children: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const prose = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const box = scroller.current;
    const body = prose.current;
    if (!box || !body) return;
    const measure = () => {
      const hidden = box.scrollHeight - box.clientHeight;
      setClipped(hidden > 8);
      setAtEnd(box.scrollTop >= hidden - 8);
    };
    measure();
    // watching the prose catches both a longer message and a narrower card — the two ways it outgrows the box
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div {...(expanded && { "data-expanded": true })} className={askBody}>
      <h2 className="flex shrink-0 items-center gap-2 text-xs font-medium text-gray-500">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-harkx-teal" />
        {state}
      </h2>
      <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
        <div
          ref={scroller}
          role="region"
          aria-label={`Full ${noun}`}
          tabIndex={clipped ? 0 : undefined}
          onScroll={(e) => setAtEnd(e.currentTarget.scrollTop >= e.currentTarget.scrollHeight - e.currentTarget.clientHeight - 8)}
          className={`min-h-0 flex-1 overflow-y-auto rounded-sm ${focusRing} ${noScrollbar} ${expanded ? "max-h-[68dvh]" : "max-h-[38dvh]"}`}
        >
          {/* the rule runs the height of the whole message, so its cut edge shows how much is still below */}
          <div ref={prose} className="max-w-[60ch] space-y-3 border-l-2 border-harkx-teal/40 pl-4 pr-1">
            {text
              .trim()
              .split(/\n{2,}/)
              .map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed text-gray-200">
                  {paragraph}
                </p>
              ))}
          </div>
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#1f1f1f] transition-opacity ${clipped && !atEnd ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      {(clipped || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`mt-3 flex shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-md text-[13px] font-medium text-gray-300 transition-colors hover:text-white ${focusRing}`}
        >
          {expanded ? "Show less" : `Read the full ${noun}`}
          <Icon d="m6 9 6 6 6-6" className={`size-3.5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
      <div className="mt-5 shrink-0 border-t border-white/10 pt-5">{children}</div>
    </div>
  );
}

function Question({ ask, onAnswer }: { ask: Extract<Ask, { type: "question" }>; onAnswer: (answer: string) => void }) {
  const [custom, setCustom] = useState<string | null>(null);
  return (
    <AskCard noun="question" state="Build paused for your answer" text={ask.question}>
      {/* the agent decides how many options there are, so the list scrolls rather than pushing the card open */}
      <div className={`flex max-h-[40dvh] flex-col gap-2 overflow-y-auto ${noScrollbar}`}>
        {ask.options.map((option, i) => (
          <button key={i} onClick={() => onAnswer(option)} className={row}>
            <span className={badge}>{i + 1}</span>
            <span className="min-w-0 flex-1">{option}</span>
          </button>
        ))}
        {custom === null ? (
          <button onClick={() => setCustom("")} className={row}>
            <span className={badge}>
              <Icon d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">Something else</span>
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
              <Icon d="M12 19V5M5 12l7-7 7 7" className="size-4" />
            </button>
          </form>
        )}
      </div>
    </AskCard>
  );
}

function FileRequest({ description, onSend }: { description: string; onSend: (files: File[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <AskCard noun="request" state="Build paused for files" text={description}>
      <div className="flex flex-col gap-2">
        {files.length > 0 && (
          // the user decides how many files there are, so this list scrolls too
          <div className={`flex max-h-[28dvh] flex-col gap-2 overflow-y-auto ${noScrollbar}`}>
            {files.map((file) => (
              <div key={file.name} className="flex items-center gap-3 rounded-xl border border-white/15 p-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{file.name}</span>
                  <span className="block text-[11px] text-gray-400">{formatSize(file.size)}</span>
                </span>
                <RemoveButton name={file.name} onClick={() => setFiles((prev) => prev.filter((f) => f !== file))} />
              </div>
            ))}
          </div>
        )}
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
      <button onClick={() => onSend([])} className={`mt-3 w-full cursor-pointer rounded-md text-center text-xs text-gray-400 transition-colors hover:text-white ${focusRing}`}>
        Continue without them
      </button>
    </AskCard>
  );
}

export default function Build({ id, onRestart, onFinish }: { id: string; onRestart: () => void; onFinish: () => void }) {
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

  // The asks bring their own layout: they are read, not watched, so they skip the centred status body.
  if (snap.status === "waiting" && snap.ask?.type === "question")
    return (
      <Question ask={snap.ask} onAnswer={(answer) => reply({ path: "answer", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) })}/>
    );

  if (snap.status === "waiting" && snap.ask?.type === "file_request")
    return (
      <FileRequest
        description={snap.ask.description}
        onSend={(files) => {
          const body = new FormData();
          files.forEach((f) => body.append("files", f));
          reply({ path: "files", method: "POST", body });
        }}
      />
    );

  return (
    <div className={stepBody}>
      {snap.status === "failed" ? (
        <>
          <span className="grid size-12 place-items-center rounded-full bg-red-500/15 text-red-400">
            <Icon d="M18 6 6 18M6 6l12 12" className="size-6" />
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">Build failed</h2>
          {/* the server writes this one too, so give it the same room to breathe */}
          <p role="alert" className="mt-2 max-h-[40dvh] overflow-y-auto text-sm text-gray-400">
            {snap.error}
          </p>
          <button onClick={onRestart} className={`mt-6 ${secondaryButton}`}>
            Try again
          </button>
        </>
      ) : snap.status === "done" ? (
        <>
          <Lottie name="tick" loop={false} className="size-32" />
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Integration ready</h2>
          <p className="mt-2 text-sm text-gray-400">Built, tested and packaged as an MCP server.</p>
          {/* the download is the last step, so taking it closes the build and hands the card back to the start */}
          <a href={`${API}/builds/${id}/download`} download onClick={onFinish} className={`mt-6 grid place-items-center ${primaryButton}`}>
            Download integration
          </a>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold tracking-tight">
            <span className="shiny-text">Building</span>
          </h2>
          <p aria-live="polite" className="mt-2 text-sm text-gray-400">
            {stages[snap.stage].label}
          </p>
          <Lottie name={stages[snap.stage].animation} className={stages[snap.stage].className} />
        </>
      )}
    </div>
  );
}
