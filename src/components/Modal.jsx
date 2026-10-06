import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from 'lucide-react'
import Tooltip from './Tooltip'

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }

// The one dialog shell. Closes on Esc, on a click outside, and with the X; locks page scroll while open.
export default function Modal({ open, onClose, title, subtitle, size = 'md', children }) {
    useEffect(() => {
        if (!open) return
        const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
        document.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
    }, [open, onClose])

    if (!open) return null
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-ink-950/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
            <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
                className={`relative w-full ${SIZES[size] || SIZES.md} my-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl shadow-ink-950/30 text-left`}>
                <div className="flex items-start justify-between gap-4 px-6 pt-6">
                    <div className="min-w-0">
                        <h2 className="text-[24px] font-semibold leading-tight text-ink-900 dark:text-white">{title}</h2>
                        {subtitle && <p className="mt-1 text-[14px] text-gray-500 dark:text-zinc-400">{subtitle}</p>}
                    </div>
                    <Tooltip label="Close" shortcut="Esc">
                        <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                            <XIcon className="size-5" />
                        </button>
                    </Tooltip>
                </div>
                <div className="px-6 pb-6 pt-4">{children}</div>
            </div>
        </div>,
        document.body,
    )
}
