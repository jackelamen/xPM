import { useMemo, useRef, useState } from 'react'
import { Loader2Icon, AlertTriangleIcon } from 'lucide-react'
import UserAvatar from './UserAvatar'

/** Can a workspace member see this task? Mirrors tasks_select + projects_select RLS. */
function canMemberSeeTask(userId, task, project) {
    if (!task || !project) return false
    const taskOk = task.visibility === 'project' || task.private_owner_id === userId
    const projOk = project.visibility === 'workspace' || project.private_owner_id === userId
    return taskOk && projOk
}

const memberLabel = (m) => m.user?.name || m.user?.email || 'Unknown'

/**
 * Comment box with @mention autocomplete over workspace members.
 * onSubmit(body, mentionedUserIds) — parent persists the comment + mentions.
 */
export default function CommentComposer({ members, task, project, submitting, onSubmit }) {
    const [value, setValue] = useState('')
    const [query, setQuery] = useState(null)   // active @query string, or null
    const [active, setActive] = useState(0)     // highlighted suggestion index
    const taRef = useRef(null)

    // Members matching the current @query (exclude self is allowed — you just won't be notified).
    const suggestions = useMemo(() => {
        if (query == null) return []
        const q = query.toLowerCase()
        return members
            .filter((m) => memberLabel(m).toLowerCase().includes(q) || (m.user?.email || '').toLowerCase().includes(q))
            .slice(0, 6)
    }, [query, members])

    // Which mentioned members can't see the task (for the suppress warning).
    const blocked = useMemo(() => {
        return members.filter(
            (m) => value.includes(`@${memberLabel(m)}`) && !canMemberSeeTask(m.user_id, task, project),
        )
    }, [value, members, task, project])

    const detectQuery = (text, caret) => {
        const upto = text.slice(0, caret)
        const at = upto.lastIndexOf('@')
        if (at === -1) return null
        // '@' must start a token (start of text or preceded by whitespace).
        if (at > 0 && !/\s/.test(upto[at - 1])) return null
        const frag = upto.slice(at + 1)
        if (/\s{2,}/.test(frag) || frag.length > 40) return null
        return frag
    }

    const handleChange = (e) => {
        const text = e.target.value
        setValue(text)
        setActive(0)
        setQuery(detectQuery(text, e.target.selectionStart))
    }

    const insertMention = (m) => {
        const ta = taRef.current
        const caret = ta ? ta.selectionStart : value.length
        const upto = value.slice(0, caret)
        const at = upto.lastIndexOf('@')
        const next = value.slice(0, at) + `@${memberLabel(m)} ` + value.slice(caret)
        setValue(next)
        setQuery(null)
        requestAnimationFrame(() => ta?.focus())
    }

    const mentionedUserIds = () =>
        members.filter((m) => value.includes(`@${memberLabel(m)}`)).map((m) => m.user_id)

    const submit = () => {
        if (!value.trim() || submitting) return
        onSubmit(value.trim(), mentionedUserIds())
        setValue('')
        setQuery(null)
    }

    const handleKeyDown = (e) => {
        if (query != null && suggestions.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + suggestions.length) % suggestions.length); return }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[active]); return }
            if (e.key === 'Escape') { setQuery(null); return }
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
    }

    return (
        <div className="relative">
            {blocked.length > 0 && (
                <div className="mb-2 flex items-start gap-2 text-[12px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2">
                    <AlertTriangleIcon className="size-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                        {blocked.map(memberLabel).join(', ')} {blocked.length === 1 ? "can't" : "can't"} see this task and won't be notified.
                    </span>
                </div>
            )}

            {query != null && suggestions.length > 0 && (
                <div className="absolute bottom-full mb-2 left-0 w-64 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#15151a] shadow-xl z-50">
                    {suggestions.map((m, i) => (
                        <button key={m.user_id} type="button"
                            onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}
                            onMouseEnter={() => setActive(i)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left ${i === active ? 'bg-gray-100 dark:bg-white/[0.06]' : ''}`}>
                            <UserAvatar user={m.user} size={22} />
                            <span className="text-[13px] text-zinc-800 dark:text-zinc-200 truncate">{memberLabel(m)}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <textarea
                    ref={taRef}
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a comment… use @ to mention (⌘+Enter to submit)"
                    rows={2}
                    className="flex-1 text-sm px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <button onClick={submit} disabled={submitting || !value.trim()}
                    className="flex items-center justify-center px-3 rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-50 transition">
                    {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <span className="text-sm">Post</span>}
                </button>
            </div>
        </div>
    )
}

/** Render a comment body with @mentions highlighted. */
export function MentionText({ body, members }) {
    const names = members.map(memberLabel).filter(Boolean).sort((a, b) => b.length - a.length)
    if (!names.length || !body) return <>{body}</>

    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const re = new RegExp(`@(${escaped.join('|')})`, 'g')
    const parts = []
    let last = 0
    let match
    while ((match = re.exec(body)) !== null) {
        if (match.index > last) parts.push(body.slice(last, match.index))
        parts.push(
            <span key={match.index} className="font-medium text-blue-600 dark:text-blue-400">{match[0]}</span>,
        )
        last = match.index + match[0].length
    }
    if (last < body.length) parts.push(body.slice(last))
    return <>{parts}</>
}
