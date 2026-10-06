// Shared form and button styles, so every dialog and form looks the same.

export const inputCls =
    "w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-[14px] text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-ink-500 focus:ring-2 focus:ring-ink-500/25"

export const labelCls = "block text-[13px] font-medium text-gray-700 dark:text-zinc-300 mb-1"

// The main action: navy. Amber is reserved for the single most important "go" in a view.
export const primaryBtn =
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold bg-ink-900 hover:bg-ink-800 text-white dark:bg-white dark:text-ink-950 dark:hover:bg-ink-100 transition-colors disabled:opacity-50"

export const accentBtn =
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold bg-signal-500 hover:bg-signal-400 text-ink-950 transition-colors disabled:opacity-50"

export const ghostBtn =
    "inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-[14px] font-medium border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"

// Project colours: distinct on white and on navy, none of them the amber accent.
export const PROJECT_COLORS = ["#2f6fb3", "#2b9c78", "#7c5cd6", "#d4496a", "#0e8fa0", "#c2410c", "#8a6d3b", "#5b6b82"]
