import { useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { Link } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { MessageSquareIcon, ChevronRightIcon } from "lucide-react"
import { supabase } from "../lib/supabase"

function Initials({ name, email }) {
    const letter = (name || email || "?")[0].toUpperCase()
    const colors = [
        "bg-blue-500", "bg-emerald-500", "bg-amber-500",
        "bg-purple-500", "bg-pink-500", "bg-indigo-500",
    ]
    const color = colors[(letter.charCodeAt(0) || 0) % colors.length]
    return (
        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0`}>
            {letter}
        </div>
    )
}

const RecentActivity = () => {
    const { currentWorkspace } = useSelector((state) => state.workspace)
    const [comments, setComments] = useState([])

    const taskLookup = useMemo(() => {
        const lookup = {}
        ;(currentWorkspace?.projects || []).forEach((project) => {
            ;(project.tasks || []).forEach((task) => {
                lookup[task.id] = {
                    projectId: project.id,
                    projectName: project.name,
                    taskTitle: task.title,
                }
            })
        })
        return lookup
    }, [currentWorkspace])

    useEffect(() => {
        const taskIds = Object.keys(taskLookup)
        if (!taskIds.length) {
            setComments([])
            return
        }

        let cancelled = false
        async function fetchComments() {
            const { data } = await supabase
                .from("task_comments")
                .select("id, task_id, body, created_at, author:profiles(id, name, email, avatar_url)")
                .in("task_id", taskIds)
                .order("created_at", { ascending: false })
                .limit(6)

            if (!cancelled) setComments(data || [])
        }

        fetchComments()
        return () => {
            cancelled = true
        }
    }, [taskLookup])

    return (
        <div className="bg-white dark:bg-white/[0.03] border border-[#e5e2e1] dark:border-white/[0.07] rounded-[24px] p-7 flex flex-col shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-[22px] font-bold text-[#000101] dark:text-white">Recent Comments</h2>
                <Link to="/projects" className="w-9 h-9 rounded-full border border-[#c5c6ca] dark:border-white/[0.1] flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:bg-[#f1eded] dark:hover:bg-white/[0.05] transition-colors" title="Open projects">
                    <MessageSquareIcon size={12} />
                </Link>
            </div>

            {comments.length === 0 ? (
                <p className="text-[13px] text-gray-400 dark:text-zinc-600 text-center py-6">No recent comments</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {comments.map((comment) => {
                        const task = taskLookup[comment.task_id]
                        return (
                        <Link
                            key={comment.id}
                            to={task?.projectId ? `/projectsDetail?id=${task.projectId}&tab=tasks` : "/projects"}
                            className="flex gap-3 p-1 -mx-1 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                        >
                            <Initials name={comment.author?.name} email={comment.author?.email} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between mb-0.5">
                                    <span className="text-[15px] font-bold text-[#000101] dark:text-zinc-200 truncate">
                                        {comment.author?.name || comment.author?.email?.split("@")[0] || "Someone"}
                                    </span>
                                    {comment.created_at && (
                                        <span className="text-[10px] text-gray-400 dark:text-zinc-600 flex-shrink-0 ml-2">
                                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[14px] text-gray-600 dark:text-zinc-500 line-clamp-2 leading-snug">
                                    {comment.body}
                                </p>
                                {task && (
                                    <p className="text-[11px] text-gray-400 dark:text-zinc-600 mt-1 truncate">
                                        {task.taskTitle} · {task.projectName}
                                    </p>
                                )}
                            </div>
                        </Link>
                        )
                    })}
                </div>
            )}

            {comments.length > 0 && (
                <Link to="/projects" className="text-[14px] text-[#000101] dark:text-white font-bold mt-6 hover:underline flex items-center gap-1 transition-colors">
                    View all activity <ChevronRightIcon size={13} />
                </Link>
            )}
        </div>
    )
}

export default RecentActivity
