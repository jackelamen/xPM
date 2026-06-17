import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { BellIcon, BellOffIcon, Loader2Icon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { pushSupported, getSubscriptionState, subscribeToPush, unsubscribeFromPush } from '../lib/push'

const DEFAULT_PREFS = {
    task_assigned_email: true, task_assigned_push: true,
    task_completed_email: true, task_completed_push: true,
    task_due_email: true, task_due_push: true,
    comment_mention_email: true, comment_mention_push: true,
}

const ROWS = [
    { key: 'task_assigned',  label: 'Task assigned to me',  desc: 'When someone assigns you a task.' },
    { key: 'task_completed', label: 'Task completed',        desc: 'When a task you created or own is marked done.' },
    { key: 'task_due',       label: 'Task due or overdue',   desc: 'A daily reminder for tasks due today or overdue.' },
    { key: 'comment_mention', label: 'Mentioned in a comment', desc: 'When someone @mentions you in a task comment.' },
]

function MiniToggle({ checked, onChange }) {
    return (
        <button type="button" onClick={() => onChange(!checked)}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-white/[0.15]'}`}>
            <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white dark:bg-gray-900 transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </button>
    )
}

export default function NotificationSettings() {
    const { user } = useAuth()
    const [prefs, setPrefs] = useState(DEFAULT_PREFS)
    const [loading, setLoading] = useState(true)
    const [pushState, setPushState] = useState({ supported: false, subscribed: false, permission: 'default' })
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!user?.id) return
        supabase.from('notification_prefs').select('*').eq('user_id', user.id).maybeSingle()
            .then(({ data }) => { if (data) setPrefs({ ...DEFAULT_PREFS, ...data }); setLoading(false) })
        if (pushSupported()) getSubscriptionState().then(setPushState)
    }, [user?.id])

    const save = async (next) => {
        setPrefs(next)
        const { error } = await supabase.from('notification_prefs').upsert(
            { user_id: user.id, ...next, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
        )
        if (error) toast.error('Failed to save preference')
    }

    const setPref = (k, v) => save({ ...prefs, [k]: v })

    const togglePush = async () => {
        setBusy(true)
        try {
            if (pushState.subscribed) {
                await unsubscribeFromPush()
                toast.success('Push notifications disabled on this device')
            } else {
                await subscribeToPush(user.id)
                toast.success('Push notifications enabled on this device')
            }
            setPushState(await getSubscriptionState())
        } catch (err) {
            toast.error(err.message || 'Could not update push notifications')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/[0.07] rounded-2xl p-6">
            <div className="mb-5">
                <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white">Notifications</h2>
                <p className="text-[12px] text-gray-500 dark:text-zinc-500 mt-0.5">Choose how you want to be notified about task activity.</p>
            </div>

            {/* Push enablement for this device */}
            <div className="flex items-center justify-between gap-4 mb-5 pb-5 border-b border-gray-100 dark:border-white/[0.06]">
                <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100">Push on this device</p>
                    <p className="text-[12px] text-gray-500 dark:text-zinc-500">
                        {!pushState.supported
                            ? 'This browser/device does not support push notifications.'
                            : pushState.permission === 'denied'
                                ? 'Blocked in browser settings — re-enable notifications for this site, then retry.'
                                : pushState.subscribed
                                    ? 'This device will receive push notifications.'
                                    : 'Enable to receive push notifications on this device.'}
                    </p>
                </div>
                <button onClick={togglePush} disabled={busy || !pushState.supported || pushState.permission === 'denied'}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12.5px] font-medium hover:opacity-90 transition disabled:opacity-40 flex-shrink-0">
                    {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : pushState.subscribed ? <BellOffIcon className="size-3.5" /> : <BellIcon className="size-3.5" />}
                    {pushState.subscribed ? 'Disable' : 'Enable'}
                </button>
            </div>

            {loading ? (
                <div className="py-6 flex justify-center"><Loader2Icon className="size-4 animate-spin text-gray-400" /></div>
            ) : (
                <div className="space-y-1">
                    <div className="flex items-center justify-end gap-6 px-1 pb-2">
                        <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 w-10 text-center">Email</span>
                        <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 w-10 text-center">Push</span>
                    </div>
                    {ROWS.map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between gap-4 py-2.5 border-t border-gray-50 dark:border-white/[0.04]">
                            <div className="min-w-0">
                                <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100">{label}</p>
                                <p className="text-[12px] text-gray-500 dark:text-zinc-500">{desc}</p>
                            </div>
                            <div className="flex items-center gap-6 flex-shrink-0">
                                <div className="w-10 flex justify-center">
                                    <MiniToggle checked={prefs[`${key}_email`]} onChange={(v) => setPref(`${key}_email`, v)} />
                                </div>
                                <div className="w-10 flex justify-center">
                                    <MiniToggle checked={prefs[`${key}_push`]} onChange={(v) => setPref(`${key}_push`, v)} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
