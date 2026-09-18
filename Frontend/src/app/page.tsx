"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const integrations = [
  { name: "Microsoft Teams", logo: "/logos/microsoft-teams.svg" },
  { name: "Discord", logo: "/logos/discord.svg" },
  { name: "Slack", logo: "/logos/slack.svg" },
  { name: "Zoom", logo: "/logos/zoom.svg" },
];

function Card({ children, round = false }: { children: React.ReactNode; round?: boolean }) {
  const ref = useRef<HTMLElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    ref.current?.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    ref.current?.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div className={`${round ? "rounded-full" : "w-full max-w-sm rounded-3xl"} bg-gradient-to-tr from-harkx-blue/20 to-harkx-green/20 p-[2px] transition-colors duration-500 hover:from-harkx-blue/40 hover:to-harkx-green/40`}>
      <section
        ref={ref}
        onMouseMove={handleMouseMove}
        className={`card-spotlight bg-[#1f1f1f] ${round ? "rounded-full" : "rounded-3xl"}`}
      >
        {children}
      </section>
    </div>
  );
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-harkx-teal";

const stepBody =
  "relative flex flex-col items-center px-6 pb-8 pt-14 text-center sm:px-8";

// Windows Explorer labels binary units as KB/MB, so match it — users compare the two.
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function Icon({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`absolute left-4 top-4 flex cursor-pointer items-center gap-1 rounded-md py-1 pl-1 pr-2 text-sm font-medium text-gray-400 transition-colors hover:text-white sm:left-6 ${focusRing}`}
    >
      <Icon className="size-4">
        <path d="M15 18 9 12l6-6" />
      </Icon>
      Back
    </button>
  );
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(integrations[0]);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card round={step === 0}>
        {step === 0 ? (
          <button
            onClick={() => setStep(1)}
            className={`flex size-40 cursor-pointer items-center justify-center rounded-full sm:size-56 ${focusRing}`}
          >
            <Image src="/logos/harkx-mark.svg" alt="HarkX" width={24} height={39} loading="eager" className="h-16 w-auto sm:h-24" />
          </button>
        ) : step === 1 ? (
          <div className={stepBody}>
            <BackButton onClick={() => setStep(0)} />
            <h2 className="text-balance text-2xl font-bold tracking-tight">
              Select integration point
            </h2>
            <div className="mt-6 grid w-full grid-cols-2 gap-3">
              {integrations.map((integration) => (
                <button
                  key={integration.name}
                  onClick={() => {
                    setSelected(integration);
                    setStep(2);
                  }}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-white/10 px-3 py-4 text-sm font-medium text-gray-300 transition-colors hover:border-white/25 hover:text-white ${focusRing}`}
                >
                  <Image src={integration.logo} alt="" width={32} height={32} className="size-8 object-contain" />
                  {integration.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={stepBody}>
            <BackButton
              onClick={() => {
                setFile(null);
                setSent(false);
                setStep(1);
              }}
            />
            <Image src={selected.logo} alt="" width={56} height={56} className="size-14 object-contain" />
            <h2 className="mt-4 text-balance text-2xl font-bold tracking-tight">
              Upload the {selected.name.replace("Microsoft ", "")} skills
            </h2>
            {/* ponytail: extension check only, and the file is held in state — nothing sends it anywhere yet */}
            {sent ? (
              <p className="mt-6 flex h-12 items-center gap-2 text-sm font-medium">
                <Icon className="size-4 shrink-0 text-harkx-teal">
                  <path d="m4.5 12.5 5 5 10-11" />
                </Icon>
                Skills uploaded
              </p>
            ) : error ? (
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
                    <span className="truncate">{file.name.slice(0, -4)}</span>
                    <span className="shrink-0">{file.name.slice(-4)}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-gray-400">{formatSize(file.size)}</span>
                </span>
                <button
                  onClick={() => setFile(null)}
                  aria-label={`Remove ${file.name}`}
                  className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white ${focusRing}`}
                >
                  <Icon className="size-4">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </Icon>
                </button>
              </div>
            ) : (
              <label
                title="Choose a .zip file"
                className="mt-6 flex size-12 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-gray-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-harkx-teal"
              >
                <input
                  type="file"
                  accept=".zip"
                  aria-label="Choose a .zip file"
                  className="sr-only"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) {
                      if (picked.name.toLowerCase().endsWith(".zip")) {
                        setFile(picked);
                      } else {
                        setError("Only .zip files are allowed");
                        setTimeout(() => setError(null), 3000);
                      }
                    }
                    e.target.value = "";
                  }}
                />
                <Icon className="size-5">
                  <path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
                </Icon>
              </label>
            )}
            {file && !sent ? (
              // ponytail: no backend to send to yet, so this just confirms locally
              <button
                onClick={() => setSent(true)}
                className={`mt-3 h-11 w-full cursor-pointer rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-gray-200 ${focusRing}`}
              >
                Upload skills
              </button>
            ) : (
              <p className={`mt-3 text-[11px] text-gray-400 ${error || sent ? "invisible" : ""}`}>
                A <span className="font-medium text-white">.zip</span> of your skill files
              </p>
            )}
          </div>
        )}
      </Card>
    </main>
  );
}
