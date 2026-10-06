import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { XIcon } from 'lucide-react'

const GO = { h: '/', t: '/my-tasks', p: '/projects', x: '/xplan', c: '/crm', r: '/reports', i: '/pulse-inbox' }

const SHORTCUTS = [
    ['⌘⇧K', 'Quick capture'],
    ['?', 'Show this cheat sheet'],
    ['G then H', 'Go to Home'],
    ['G then T', 'Go to My Tasks'],
    ['G then P', 'Go to Projects'],
    ['G then X', 'Go to xPlan'],
    ['G then C', 'Go to CRM'],
    ['G then R', 'Go to Reports'],
    ['G then I', 'Go to Pulse inbox'],
    ['Esc', 'Close panels and dialogs'],
]

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

// "?" opens a cheat sheet; "g" then a letter jumps between pages.
export default function ShortcutsHelp() {
    const [open, setOpen] = useState(false)
    const navigate = useNavigate()
    const chord = useRef(0)

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') { setOpen(false); return }
            if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return
            if (e.key === '?') { e.preventDefault(); setOpen((v) => !v); return }
            if (chord.current && Date.now() - chord.current < 1200 && GO[e.key.toLowerCase()]) {
                e.preventDefault(); chord.current = 0; navigate(GO[e.key.toLowerCase()]); return
            }
            chord.current = e.key.toLowerCase() === 'g' ? Date.now() : 0
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [navigate])

    if (!open) return null
    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} />
            <div role="dialog" aria-label="Keyboard shortcuts"
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">Keyboard shortcuts</h2>
                    <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" aria-label="Close">
                        <XIcon className="size-4" />
                    </button>
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {SHORTCUTS.map(([keys, label]) => (
                        <li key={keys} className="flex items-center justify-between py-2 text-[13px]">
                            <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
                            <kbd className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">{keys}</kbd>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    )
}
