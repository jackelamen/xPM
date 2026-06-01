import { useMemo, useState } from 'react';
import { CheckSquareIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function MyTasksSidebar() {

    const { user } = useAuth()
    const { currentWorkspace } = useSelector((state) => state.workspace);
    const [showMyTasks, setShowMyTasks] = useState(false);

    const toggleMyTasks = () => setShowMyTasks(prev => !prev);

    const getTaskStatusColor = (status) => {
        switch (status) {
            case 'DONE': return 'bg-green-500';
            case 'IN_PROGRESS': return 'bg-yellow-500';
            case 'TODO': return 'bg-gray-500 dark:bg-zinc-500';
            default: return 'bg-gray-400 dark:bg-zinc-400';
        }
    };

    const myTasks = useMemo(() => {
        if (!user || !currentWorkspace) return []
        return currentWorkspace.projects.flatMap((project) =>
            (project.tasks || [])
                .filter((task) => task.assignee_id === user.id)
                .map((task) => ({ ...task, projectId: project.id }))
        )
    }, [currentWorkspace, user])

    return (
        <div className="mt-3 px-2">
            <div
                onClick={toggleMyTasks}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.04] transition-colors"
            >
                {showMyTasks
                    ? <ChevronDownIcon className="w-3 h-3 flex-shrink-0" />
                    : <ChevronRightIcon className="w-3 h-3 flex-shrink-0" />
                }
                <span className="text-[10px] font-semibold uppercase tracking-widest">My Tasks</span>
                {myTasks.length > 0 && (
                    <span className="ml-auto text-[10px] font-medium text-gray-400 dark:text-zinc-600 tabular-nums">
                        {myTasks.length}
                    </span>
                )}
            </div>

            {showMyTasks && (
                <div className="mt-0.5 space-y-0.5">
                    {myTasks.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-gray-400 dark:text-zinc-600">
                            No tasks assigned
                        </div>
                    ) : (
                        myTasks.map((task, index) => (
                            <Link
                                key={index}
                                to={`/projectsDetail?id=${task.projectId}&tab=tasks`}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.04] transition-colors"
                            >
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getTaskStatusColor(task.status)}`} />
                                <span className="text-[12px] font-medium truncate">{task.title}</span>
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default MyTasksSidebar;
