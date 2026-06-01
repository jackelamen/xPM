import { useState } from 'react'
import MyTasksCard from '../components/MyTasksCard'
import ProjectStatusCard from '../components/ProjectStatusCard'
import ProjectsOverviewCard from '../components/ProjectsOverviewCard'
import RecentProjectsCard from '../components/RecentProjectsCard'
import MiniCalendar from '../components/MiniCalendar'
import RecentActivity from '../components/RecentActivity'
import CreateProjectDialog from '../components/CreateProjectDialog'
import QuickCapture from '../components/QuickCapture'
import { useAuth } from '../context/AuthContext'

const Dashboard = () => {
    const { displayName } = useAuth()
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

    return (
        <div className='max-w-[1400px] mx-auto'>
            {/* Header */}
            <div className="flex items-center justify-between mb-7 gap-4">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                        Manage and track your projects
                    </p>
                    <h1 className="text-[28px] font-bold text-gray-900 dark:text-white tracking-tight leading-snug truncate">
                        {greeting}, {displayName}
                    </h1>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <QuickCapture variant="inline" />
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap"
                    >
                        + New Project
                    </button>
                </div>
                <CreateProjectDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            </div>

            {/* 3-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Column 1: My Tasks */}
                <div className="lg:col-span-3">
                    <MyTasksCard />
                </div>

                {/* Column 2: Projects Overview + Recent + Status */}
                <div className="lg:col-span-5 flex flex-col gap-5">
                    <ProjectsOverviewCard />
                    <RecentProjectsCard />
                    <ProjectStatusCard />
                </div>

                {/* Column 3: Calendar + Activity */}
                <div className="lg:col-span-4 flex flex-col gap-5">
                    <MiniCalendar />
                    <RecentActivity />
                </div>
            </div>
        </div>
    )
}

export default Dashboard
