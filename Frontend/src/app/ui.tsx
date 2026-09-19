export const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-harkx-teal";

export const stepBody = "relative flex flex-col items-center px-6 pb-8 pt-14 text-center sm:px-8";

export const secondaryButton = `h-11 w-full cursor-pointer rounded-full border border-white/15 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5 ${focusRing}`;

export const primaryButton = `h-11 w-full cursor-pointer rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

// Windows Explorer labels binary units as KB/MB, so match it — users compare the two.
export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function Icon({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export function RemoveButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Remove ${name}`}
      className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white ${focusRing}`}
    >
      <Icon className="size-4">
        <path d="M6 6l12 12M18 6 6 18" />
      </Icon>
    </button>
  );
}
