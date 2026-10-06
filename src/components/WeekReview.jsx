import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { format, nextMonday } from 'date-fns'
import { CheckCircle2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { archiveTasks, updateTask } from '../features/workspaceSlice'
import { allTasks, isMine, openLeaves, weekStartOf, whenOf, ymd } from '../lib/flow'

// Friday close-out: what got done, and a one-click decision for everything that didn't.
export default function WeekReview({ onPlanNext }) {
    const { user, rituals, markRitual } = useAuth()
    const dispatch = useDispatch()
    const projects = useSelector((s) => s.workspace?.currentWorkspace?.projects || [])
    const [done, setDone] = useState([])
    const [busy, setBusy] = useState(false)

    const weekKey = ymd(weekStartOf())
    const todayStr = ymd(new Date())
    const closed = rituals.reviewed === weekKey

    const projectIds = useMemo(() => projects.map((p) => p.id), [projects])
    useEffect(() => {
        if (!user?.id || !projectIds.length) return
        supabase.from('xpm_tasks').select('id, title, project_id, completed_at')
            .in('project_id', projectIds).eq('status', 'DONE').eq('assignee_id', user.id)
            .gte('completed_at', weekStartOf().toISOString()).order('completed_at', { ascending: false })
            .then(({ data }) => setDone(data || []))
    }, [user?.id, projectIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

    const slipped = useMemo(() => openLeaves(allTasks(projects))
        .filter((t) => isMine(t, user?.id) && !t.custom_fields?.someday && whenOf(t) && whenOf(t) <= todayStr)
        .sort((a, b) => whenOf(a).localeCompare(whenOf(b))), [projects, user?.id, todayStr])

    const nextWeekStr = ymd(nextMonday(new Date()))
    const fail = (e) => toast.error(e || 'Could not save')
    const roll = (t) => dispatch(updateTask({ taskId: t.id, projectId: t.projectId, fields: { start_date: nextWeekStr } })).unwrap().catch(fail)
    const someday = (t) => dispatch(updateTask({ taskId: t.id, projectId: t.projectId, fields: { start_date: null, custom_fields: { ...(t.custom_fields || {}), someday: true } } })).unwrap().catch(fail)
    const drop = (t) => dispatch(archiveTasks({ taskIds: [t.id], projectId: t.projectId })).unwrap().catch(fail)
    const rollAll = async () => { setBusy(true); for (const t of slipped) await roll(t); setBusy(false) }

    const close = async () => {
        try { await markRitual({ reviewed: weekKey }); toast.success('Week closed') } catch (e) { fail(e.message) }
    }

    if (closed && slipped.length === 0) {
        return (
            <div className="max-w-xl mx-auto text-center py-16">
                <CheckCircle2Icon className="size-10 mx-auto text-emerald-500 mb-4" />
                <h1 className="text-[24px] font-bold tracking-tight text-gray-900 dark:text-white">Week closed</h1>
                <p className="text-[14px] text-gray-500 dark:text-zinc-400 mt-2">{done.length} task{done.length === 1 ? '' : 's'} finished this week.</p>
                <button onClick={onPlanNext} className="mt-6 px-4 py-2 rounded-lg text-[13px] font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900">Plan next week</button>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">Review the week</h1>
            <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-1">Week of {format(weekStartOf(), 'MMM d')}</p>

            <div className="mt-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4">
                <p className="text-[28px] font-bold text-gray-900 dark:text-white tabular-nums leading-tight">{done.length}</p>
                <p className="text-[13px] text-gray-500 dark:text-zinc-400">finished this week</p>
                {done.length > 0 && (
                    <ul className="mt-3 space-y-1">
                        {done.slice(0, 6).map((t) => <li key={t.id} className="text-[13px] text-gray-600 dark:text-zinc-300 truncate">✓ {t.title}</li>)}
                        {done.length > 6 && <li className="text-[12px] text-gray-400">and {done.length - 6} more</li>}
                    </ul>
                )}
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
                    <p className="text-[14px] font-semibold text-gray-800 dark:text-zinc-200">Didn't happen · {slipped.length}</p>
                    {slipped.length > 1 && <button onClick={rollAll} disabled={busy} className="text-[13px] text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40">Roll all to next week</button>}
                </div>
                {slipped.length === 0
                    ? <p className="px-5 py-6 text-[13px] text-gray-500 dark:text-zinc-400">Nothing slipped. Everything planned got done.</p>
                    : <ul>{slipped.map((t) => (
                        <li key={t.id} className="px-5 py-3 border-b border-gray-50 dark:border-zinc-800/60 last:border-0">
                            <p className="text-[14px] text-gray-900 dark:text-zinc-100">{t.title}</p>
                            <p className="text-[12px] text-gray-400 dark:text-zinc-500">{t.projectName} · planned {format(new Date(`${whenOf(t)}T00:00:00`), 'EEE MMM d')}</p>
                            <div className="flex gap-3 mt-2 text-[13px]">
                                <button onClick={() => roll(t)} className="font-medium text-gray-900 dark:text-white">Roll to next week</button>
                                <button onClick={() => someday(t)} className="text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">Someday</button>
                                <button onClick={() => drop(t)} className="text-gray-400 hover:text-red-600" title="Archives the task; you can restore it from Archive">Drop</button>
                            </div>
                        </li>
                    ))}</ul>}
            </div>

            <div className="mt-6 flex items-center gap-3">
                <button onClick={close} className="px-4 py-2 rounded-lg text-[14px] font-medium bg-emerald-600 text-white">{closed ? 'Week closed' : 'Close the week'}</button>
                {closed && <button onClick={onPlanNext} className="text-[13px] text-gray-600 dark:text-zinc-300 underline">Plan next week</button>}
            </div>
        </div>
    )
}
