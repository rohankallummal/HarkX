"use client";

import Image from "next/image";
import { useState } from "react";
import Build, { API } from "./Build";
import { skillFileError } from "./skillFile";
import { focusRing, formatSize, Icon, noScrollbar, primaryButton, RemoveButton, secondaryButton, stepBody } from "./ui";

type Integration = { name: string; logo?: string; glyph?: React.ReactNode };

// Apps show their brand logo; System and Tools use a line glyph tinted in a HarkX colour,
// so the kind of integration reads from the icon alone.
// ponytail: System and Tools entries are placeholders until the real list is decided
const categories: Record<"Apps" | "System" | "Tools", { tint?: string; items: Integration[] }> = {
  Apps: {
    items: [
      { name: "Teams", logo: "/logos/microsoft-teams.svg" },
      { name: "Discord", logo: "/logos/discord.svg" },
      { name: "Slack", logo: "/logos/slack.svg" },
      { name: "Zoom", logo: "/logos/zoom.svg" },
      { name: "Outlook", logo: "/logos/outlook.svg" },
    ],
  },
  System: {
    tint: "bg-harkx-teal/15 text-harkx-teal",
    items: [
      { name: "Files", glyph: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /> },
      { name: "Terminal", glyph: <path d="m4 17 6-6-6-6M12 19h8" /> },
      { name: "Clipboard", glyph: <><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></> },
      { name: "Notifications", glyph: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /> },
    ],
  },
  Tools: {
    // brand blue is too dark to read on the card, so the glyph uses a lighter step of it
    tint: "bg-harkx-blue/30 text-[#6aa8e6]",
    items: [
      { name: "Web search", glyph: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></> },
      { name: "Calendar", glyph: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
      { name: "Calculator", glyph: <><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" /></> },
      { name: "Code runner", glyph: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /> },
    ],
  },
};

type Category = keyof typeof categories;
const categoryNames = Object.keys(categories) as Category[];
// Search spans every category, so each result carries its category's tint with it.
const withTint = (c: Category) => categories[c].items.map((item) => ({ ...item, tint: categories[c].tint }));
const allIntegrations = categoryNames.flatMap(withTint);

function Card({ children, round = false }: { children: React.ReactNode; round?: boolean }) {
  return (
    // an expanded ask asks for a reading column, so the card widens to give it one
    <div
      className={`${round ? "rounded-full" : "w-full max-w-sm rounded-3xl has-[[data-expanded]]:max-w-2xl"} bg-gradient-to-tr from-harkx-blue/20 to-harkx-green/20 p-[2px] transition-[max-width,--tw-gradient-from,--tw-gradient-to] duration-300 hover:from-harkx-blue/40 hover:to-harkx-green/40 motion-reduce:transition-none`}
    >
      <section
        onMouseMove={(e) => {
          const { left, top } = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - left}px`);
          e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - top}px`);
        }}
        className={`card-spotlight bg-[#1f1f1f] ${round ? "rounded-full" : "rounded-3xl"}`}
      >
        {children}
      </section>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`absolute left-4 top-4 flex cursor-pointer items-center gap-1 rounded-md py-1 pl-1 pr-2 text-sm font-medium text-gray-400 transition-colors hover:text-white sm:left-6 ${focusRing}`}
    >
      <Icon d="M15 18 9 12l6-6" className="size-4" />
      Back
    </button>
  );
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Integration>(categories.Apps.items[0]);
  const [category, setCategory] = useState<Category>("Apps");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [customName, setCustomName] = useState("");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = q ? allIntegrations.filter((i) => i.name.toLowerCase().includes(q)) : withTint(category);

  const upload = async () => {
    setUploading(true);
    const body = new FormData();
    body.append("name", selected.name);
    body.append("file", file!);
    try {
      const res = await fetch(`${API}/builds`, { method: "POST", body });
      if (!res.ok) throw new Error((await res.json()).detail);
      setBuildId((await res.json()).id);
      setStep(3);
    } catch (e) {
      setError(e instanceof TypeError ? "Couldn't reach the build server" : String((e as Error).message));
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const pick = (integration: Integration) => {
    setSelected(integration);
    setStep(2);
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card round={step === 0}>
        {step === 0 ? (
          <button onClick={() => setStep(1)} className={`flex size-40 cursor-pointer items-center justify-center rounded-full sm:size-56 ${focusRing}`}>
            <Image src="/logos/harkx-mark.svg" alt="HarkX" width={24} height={39} loading="eager" className="h-16 w-auto sm:h-24" />
          </button>
        ) : step === 1 ? (
          <div className={stepBody}>
            {/* Back leaves the add form first, since it has no cancel of its own */}
            <BackButton onClick={() => (adding ? setAdding(false) : setStep(0))} />
            <h2 className="text-balance text-2xl font-bold tracking-tight">
              {adding ? "Name your Integration" : "Select integration point"}
            </h2>
            {adding ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  pick({ name: customName.trim() });
                }}
                className="mt-6 flex w-full flex-col gap-3 text-left"
              >
                <input
                  aria-label="Name of the integration point"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Webex"
                  autoFocus
                  required
                  maxLength={40}
                  className="h-11 w-full rounded-xl border border-white/15 bg-transparent px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-harkx-teal"
                />
                <button type="submit" disabled={!customName.trim()} className={primaryButton}>
                  Continue
                </button>
              </form>
            ) : (
              <>
                <div className="relative mt-6 w-full">
                  <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </Icon>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search integrations"
                    maxLength={40}
                    aria-label="Search integrations"
                    className="h-11 w-full rounded-xl border border-white/15 bg-transparent pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-harkx-teal"
                  />
                </div>
                {/* the tabs make way for a result count while searching, in the same row */}
                <div className="mt-4 flex h-7 justify-center gap-6">
                  {q ? (
                    <p aria-live="polite" className="text-sm text-gray-400">
                      {shown.length} {shown.length === 1 ? "match" : "matches"}
                    </p>
                  ) : (
                    // native radios: arrow keys move between categories for free
                    <div role="radiogroup" aria-label="Integration type" className="flex gap-6">
                      {categoryNames.map((c) => (
                        <label
                          key={c}
                          className={`cursor-pointer border-b-2 pb-1 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-harkx-teal ${category === c ? "border-white text-white" : "border-transparent text-gray-400 hover:text-white"}`}
                        >
                          <input type="radio" name="category" checked={category === c} onChange={() => setCategory(c)} className="sr-only" />
                          {c}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {/* Fixed at exactly two rows of tiles; more than four scroll inside it (scrollbar hidden), so the card never grows. */}
                <div key={q ? "search" : category} className={`-mx-0.5 mt-3 h-[12.5rem] self-stretch overflow-y-auto p-0.5 ${noScrollbar}`}>
                  {shown.length ? (
                    <div className="grid grid-cols-2 gap-3">
                      {shown.map((integration) => (
                        <button
                          key={integration.name}
                          onClick={() => pick(integration)}
                          className={`flex h-[5.75rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-gray-300 transition-colors hover:border-white/25 hover:text-white ${focusRing}`}
                        >
                          {integration.logo ? (
                            <Image src={integration.logo} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />
                          ) : (
                            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${integration.tint}`}>
                              <Icon className="size-[18px]">{integration.glyph}</Icon>
                            </span>
                          )}
                          <span className="max-w-full truncate">{integration.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => pick({ name: query.trim() })}
                      className={`w-full cursor-pointer rounded-xl border border-dashed border-white/20 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-white/40 hover:text-white ${focusRing}`}
                    >
                      Add “{query.trim()}” as a new integration point
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setCustomName(query.trim());
                    setAdding(true);
                  }}
                  className={`mt-3 shrink-0 ${secondaryButton}`}
                >
                  Add your own
                </button>
              </>
            )}
          </div>
        ) : step === 3 && buildId ? (
          <Build
            id={buildId}
            onRestart={() => {
              setFile(null);
              setStep(2);
            }}
            onFinish={() => {
              setFile(null);
              setBuildId(null);
              setStep(0);
            }}
          />
        ) : (
          <div className={stepBody}>
            <BackButton
              onClick={() => {
                setFile(null);
                setStep(1);
              }}
            />
            {selected.logo && <Image src={selected.logo} alt="" width={56} height={56} className="size-14 object-contain" />}
            <h2 className={`${selected.logo ? "mt-4" : ""} text-balance text-2xl font-bold tracking-tight`}>
              Upload skills for {selected.name}
            </h2>
            {error ? (
              <p role="alert" className="mt-6 flex h-12 items-center text-sm font-medium text-red-400">
                {error}
              </p>
            ) : file ? (
              <div className="mt-6 flex w-full items-center gap-3 rounded-xl border border-white/15 p-2.5 text-left">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-harkx-teal/15 text-harkx-teal">
                  <Icon className="size-[18px]">
                    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
                    <path d="M12 22V12" />
                    <polyline points="3.29 7 12 12 20.71 7" />
                    <path d="m7.5 4.27 9 5.15" />
                  </Icon>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex text-sm font-medium">
                    <span className="truncate">{file.name.slice(0, file.name.lastIndexOf("."))}</span>
                    <span className="shrink-0">{file.name.slice(file.name.lastIndexOf("."))}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-gray-400">{formatSize(file.size)}</span>
                </span>
                <RemoveButton name={file.name} onClick={() => setFile(null)} />
              </div>
            ) : (
              <label
                title="Choose a .zip or .md file"
                className="mt-6 flex size-12 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-gray-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-harkx-teal"
              >
                <input
                  type="file"
                  accept=".zip,.md"
                  aria-label="Choose a .zip or .md file"
                  className="sr-only"
                  onChange={async (e) => {
                    const picked = e.target.files?.[0];
                    e.target.value = "";
                    if (!picked) return;
                    const problem = await skillFileError(picked);
                    if (problem) {
                      setError(problem);
                      setTimeout(() => setError(null), 3000);
                    } else {
                      setFile(picked);
                    }
                  }}
                />
                <Icon d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" className="size-5" />
              </label>
            )}
            {file && !error ? (
              <button onClick={upload} disabled={uploading} className={`mt-3 ${primaryButton}`}>
                {uploading ? "Uploading…" : "Upload skills"}
              </button>
            ) : (
              <p className={`mt-3 text-[11px] text-gray-400 ${error ? "invisible" : ""}`}>
                A <span className="font-medium text-white">.zip</span> of your Skill, or a single <span className="font-medium text-white">.md</span>
              </p>
            )}
          </div>
        )}
      </Card>
    </main>
  );
}
