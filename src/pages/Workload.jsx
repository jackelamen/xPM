import { useState } from "react"
import WorkloadView from "../components/WorkloadView"
import TaskPanel from "../components/TaskPanel"

export default function Workload() {
    const [selectedTask, setSelectedTask] = useState(null)

    const handleTaskClick = (task) => {
        setSelectedTask(task)
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Workload</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Team capacity and task distribution across all projects
                </p>
            </div>

            <WorkloadView onTaskClick={handleTaskClick} />

            {selectedTask && (
                <TaskPanel
                    taskId={selectedTask.id}
                    projectId={selectedTask.project_id}
                    onClose={() => setSelectedTask(null)}
                />
            )}
        </div>
    )
}
