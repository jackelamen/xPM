import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellIcon, CheckCheckIcon, UserPlusIcon, CheckCircle2Icon, ClockIcon, Loader2Icon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TYPE_META = {
    TASK_ASSIGNED:  { Icon: UserPlusIcon,     color: 'text-indigo-500' },
    TASK_COMPLETED: { Icon: CheckCircle2Icon, color: 'text-emerald-500' },
    TASK_DUE:       { Icon: ClockIcon,        color: 'text-amber-500' },
}

export default function NotificationBell() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const ref = useRef(null)

    const unread = items.filter((n) => !n.read_at).length

    const load = useCallback(async () => {
        if (!user?.id) return
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('recipient_id', user.id)
            .order('created_at', { ascending: false })
            .limit(30)
        setItems(data || [])
        setLoading(false)
    }, [user?.id])

    useEffect(() => { load() }, [load])

    // Realtime: prepend new notifications as they arrive.
    useEffect(() => {
        if (!user?.id) return
        const channel = supabase
            .channel(`notifications:${user.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
                (payload) => setItems((prev) => [payload.new, ...prev].slice(0, 30)),
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [user?.id])

    // Close on outside click.
    useEffect(() => {
        const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    const markAllRead = async () => {
        const now = new Date().toISOString()
        setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
        await supabase.from('notifications').update({ read_at: now }).eq('recipient_id', user.id).is('read_at', null)
    }

    const handleClick = async (n) => {
        if (!n.read_at) {
            const now = new Date().toISOString()
            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)))
            await supabase.from('notifications').update({ read_at: now }).eq('id', n.id)
        }
        setOpen(false)
        if (n.task_id && n.project_id) {
            navigate(`/projectsDetail?id=${n.project_id}&tab=tasks&task=${n.task_id}`)
        }
    }

    return (
        <div className="relative flex-shrink-0" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                title="Notifications"
                className="relative p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
                <BellIcon size={18} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-hidden rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#15151a] shadow-xl z-50 flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/[0.06]">
                        <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Notifications</span>
                        {unread > 0 && (
                            <button onClick={markAllRead}
                                className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                <CheckCheckIcon size={13} /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto">
                        {loading ? (
                            <div className="py-10 flex justify-center"><Loader2Icon className="size-4 animate-spin text-gray-400" /></div>
                        ) : items.length === 0 ? (
                            <div className="py-10 text-center text-[12px] text-gray-400 dark:text-zinc-500">You're all caught up</div>
                        ) : (
                            items.map((n) => {
                                const meta = TYPE_META[n.type] || { Icon: BellIcon, color: 'text-gray-400' }
                                const Icon = meta.Icon
                                return (
                                    <button key={n.id} onClick={() => handleClick(n)}
                                        className={`w-full text-left flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors ${n.read_at ? '' : 'bg-indigo-50/40 dark:bg-indigo-500/[0.06]'}`}>
                                        <Icon size={16} className={`${meta.color} mt-0.5 flex-shrink-0`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12.5px] font-medium text-gray-900 dark:text-zinc-100 truncate">{n.title}</p>
                                            {n.body && <p className="text-[12px] text-gray-500 dark:text-zinc-400 truncate">{n.body}</p>}
                                            <p className="text-[11px] text-gray-400 dark:text-zinc-600 mt-0.5">
                                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                            </p>
                                        </div>
                                        {!n.read_at && <span className="size-2 rounded-full bg-indigo-500 mt-1 flex-shrink-0" />}
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
