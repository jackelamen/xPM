import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { InboxIcon, ZapIcon, Loader2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePulse } from '../context/PulseContext'
import { createProject } from '../features/workspaceSlice'

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Pulse tasks tagged with a project name that didn't match exactly one xPM
// project. Only tagged tasks appear here; the rest of the Pulse list is never read.
export default function PulseInbox() {
    const { user, pulse } = useAuth()
    const { needsReview, reload, ready } = usePulse()
    const dispatch = useDispatch()
    const workspace = useSelector((s) => s.workspace?.currentWorkspace)
    const projects = useMemo(() => workspace?.projects || [], [workspace])
    const [picked, setPicked] = useState({})
    const [busy, setBusy] = useState(null)

    // Best guess from the tag, so the common case is one click.
    const guess = (link) => {
        const t = norm(link.pulse_project_tag)
        if (!t) return ''
        return (projects.find((p) => norm(p.name) === t) || projects.find((p) => norm(p.name).includes(t) || t.includes(norm(p.name))))?.id || ''
    }
    const projectFor = (l) => picked[l.id] ?? guess(l)

    const run = async (link, fn, okMsg) => {
        setBusy(link.id)
        try { await fn(); toast.success(okMsg); await reload() }
        catch (err) { toast.error(err?.message || err || 'Something went wrong') }
        finally { setBusy(null) }
    }

    const setLink = (link, patch) => supabase.from('pulse_xpm_task_links')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', link.id)
        .then(({ error }) => { if (error) throw error })

    const confirm = (link, projectId) => run(link,
        () => setLink(link, { xpm_project_id: projectId, xpm_workspace_id: workspace.id, sync_status: 'linked' }),
        'Linked')

    const createAndLink = (link) => run(link, async () => {
        const name = link.pulse_project_tag
        const proj = await dispatch(createProject({ workspaceId: workspace.id, name })).unwrap()
        await setLink(link, { xpm_project_id: proj.id, xpm_workspace_id: workspace.id, sync_status: 'linked' })
    }, 'Project created and linked')

    const promote = (link, projectId) => run(link, async () => {
        const { data: task, error } = await supabase.from('xpm_tasks').insert({
            workspace_id: workspace.id, project_id: projectId,
            title: link.pulse_task_title || 'Pulse task',
            status: 'TODO', priority: 'MEDIUM', created_by: user.id, assignee_id: user.id,
        }).select('id').single()
        if (error) throw error
        await setLink(link, { xpm_task_id: task.id, xpm_project_id: projectId, xpm_workspace_id: workspace.id, sync_status: 'promoted' })
    }, 'Created as an xPM task')

    const ignore = (link) => run(link, () => setLink(link, { sync_status: 'ignored' }), 'Ignored')

    if (!pulse.enabled) {
        return <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Turn on Pulse in Settings to use the Pulse inbox.</p>
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                    <InboxIcon className="size-5 text-violet-500" /> Pulse inbox
                </h1>
                <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-1">
                    Work you tagged in Pulse that didn't match exactly one xPM project. Pick where it belongs.
                </p>
            </div>

            {!ready ? (
                <div className="flex justify-center py-16"><Loader2Icon className="size-5 animate-spin text-zinc-400" /></div>
            ) : needsReview.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-zinc-800 py-14 text-center">
                    <p className="text-[14px] font-medium text-gray-700 dark:text-zinc-200">Nothing to review</p>
                    <p className="text-[13px] text-gray-400 dark:text-zinc-500 mt-1">When a tag in Pulse doesn't match one xPM project, it lands here.</p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {needsReview.map((l) => {
                        const pid = projectFor(l)
                        const disabled = busy === l.id
                        return (
                            <li key={l.id} className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                                <div className="flex items-start gap-2">
                                    <ZapIcon className="size-4 mt-0.5 text-violet-500 flex-shrink-0" fill="currentColor" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-medium text-gray-900 dark:text-zinc-100">{l.pulse_task_title || 'Untitled Pulse task'}</p>
                                        {l.pulse_project_tag && (
                                            <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-0.5">Tagged “{l.pulse_project_tag}” in Pulse</p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <select value={pid} onChange={(e) => setPicked((p) => ({ ...p, [l.id]: e.target.value }))}
                                        className="min-w-[180px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-zinc-900 text-[13px] text-gray-800 dark:text-zinc-200">
                                        <option value="">Choose a project…</option>
                                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <button disabled={!pid || disabled} onClick={() => confirm(l, pid)}
                                        className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-40">
                                        Link
                                    </button>
                                    <button disabled={!pid || disabled} onClick={() => promote(l, pid)}
                                        className="px-3 py-1.5 rounded-lg text-[13px] border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 disabled:opacity-40">
                                        Also create xPM task
                                    </button>
                                    {l.pulse_project_tag && (
                                        <button disabled={disabled} onClick={() => createAndLink(l)}
                                            className="px-3 py-1.5 rounded-lg text-[13px] border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 disabled:opacity-40">
                                            Create project “{l.pulse_project_tag}”
                                        </button>
                                    )}
                                    <button disabled={disabled} onClick={() => ignore(l)}
                                        className="ml-auto px-3 py-1.5 rounded-lg text-[13px] text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-40">
                                        Ignore
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
