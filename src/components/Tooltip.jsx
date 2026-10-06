import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// One tooltip for the whole app.
//
// - Shows on mouse hover and on keyboard focus, after a short delay; Esc, scrolling or a click closes it.
// - Drawn in a portal with fixed positioning, so it is never clipped by a panel or table cell.
// - Flips to the other side when there isn't room.
// - Touch devices never show it, so anything essential must also be visible on screen.
// - `shortcut` adds a key hint, e.g. shortcut="⌘⇧K".
//
// Use it for icon-only controls, ambiguous shorthand, shortcuts and "why is this disabled".
// Don't wrap a button whose label already says the same thing.
export default function Tooltip({ label, shortcut, side = 'top', delay = 250, className = '', children }) {
    const [open, setOpen] = useState(false)
    const [pos, setPos] = useState(null)
    const trigger = useRef(null)
    const tip = useRef(null)
    const timer = useRef(null)
    const id = useId()

    const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), delay) }
    const hide = () => { clearTimeout(timer.current); setOpen(false); setPos(null) }

    useEffect(() => () => clearTimeout(timer.current), [])

    useEffect(() => {
        if (!open) return
        const onKey = (e) => { if (e.key === 'Escape') hide() }
        window.addEventListener('keydown', onKey)
        window.addEventListener('scroll', hide, true)
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', hide, true) }
    }, [open])

    useLayoutEffect(() => {
        if (!open || !trigger.current || !tip.current) return
        const t = trigger.current.getBoundingClientRect()
        const b = tip.current.getBoundingClientRect()
        const gap = 8, vw = window.innerWidth, vh = window.innerHeight
        let s = side
        if (s === 'top' && t.top - b.height - gap < 4) s = 'bottom'
        else if (s === 'bottom' && t.bottom + b.height + gap > vh - 4) s = 'top'
        else if (s === 'right' && t.right + b.width + gap > vw - 4) s = 'left'
        else if (s === 'left' && t.left - b.width - gap < 4) s = 'right'
        let left, top
        if (s === 'top' || s === 'bottom') {
            left = t.left + t.width / 2 - b.width / 2
            top = s === 'top' ? t.top - b.height - gap : t.bottom + gap
        } else {
            top = t.top + t.height / 2 - b.height / 2
            left = s === 'right' ? t.right + gap : t.left - b.width - gap
        }
        setPos({ left: Math.max(6, Math.min(left, vw - b.width - 6)), top: Math.max(6, Math.min(top, vh - b.height - 6)) })
    }, [open, side, label, shortcut])

    if (!label) return children

    return (
        <>
            <span ref={trigger} className={`inline-flex ${className}`}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') show() }}
                onPointerLeave={hide} onFocus={show} onBlur={hide} onClick={hide}
                aria-describedby={open ? id : undefined}>
                {children}
            </span>
            {open && createPortal(
                <div ref={tip} id={id} role="tooltip"
                    style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
                    className="pointer-events-none z-[100] max-w-[260px] rounded-md bg-ink-950 dark:bg-white px-2.5 py-1.5 text-[12px] leading-snug text-white dark:text-ink-950 shadow-lg shadow-ink-950/25 whitespace-pre-line">
                    {label}
                    {shortcut && <kbd className="ml-2 rounded bg-white/15 dark:bg-ink-950/10 px-1.5 py-px font-mono text-[11px]">{shortcut}</kbd>}
                </div>,
                document.body,
            )}
        </>
    )
}
