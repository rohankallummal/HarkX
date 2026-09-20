export const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-harkx-teal";

export const stepBody = "relative flex flex-col items-center px-6 pb-8 pt-14 text-center sm:px-8";

// When the agent needs something the card becomes a reading surface: left aligned, and never taller
// than the viewport, so the controls at its foot are always on screen no matter how much it wrote.
export const askBody = "flex max-h-[calc(100dvh-2rem)] flex-col px-5 pb-6 pt-7 text-left sm:px-6";

// Hidden bar, not hidden content: the cards hint at their own overflow with a fade and a count.
export const noScrollbar = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export const secondaryButton = `h-11 w-full cursor-pointer rounded-full border border-white/15 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5 ${focusRing}`;

export const primaryButton = `h-11 w-full cursor-pointer rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

// Windows Explorer labels binary units as KB/MB, so match it — users compare the two.
export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Most glyphs are a lone path, so `d` saves wrapping one; the rest pass shapes as children.
export function Icon({ d, children, className }: { d?: string; children?: React.ReactNode; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {d ? <path d={d} /> : children}
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
      <Icon d="M6 6l12 12M18 6 6 18" className="size-4" />
    </button>
  );
}
