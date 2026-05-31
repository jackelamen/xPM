import { useState } from 'react'
import MyTasksCard from '../components/MyTasksCard'
import ProjectStatusCard from '../components/ProjectStatusCard'
import ProjectsOverviewCard from '../components/ProjectsOverviewCard'
import MiniCalendar from '../components/MiniCalendar'
import MyMeetingsCard from '../components/MyMeetingsCard'
import RecentActivity from '../components/RecentActivity'
import CreateProjectDialog from '../components/CreateProjectDialog'
import { useAuth } from '../context/AuthContext'

const Dashboard = () => {

    const { user } = useAuth()
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'
    return (
        <div className='max-w-[1600px] mx-auto'>
            {/* Header */}
            <div className="flex items-end justify-between mb-8">
                <div>
                    <p className="text-[13px] font-semibold text-gray-600 dark:text-zinc-400 mb-1">Manage and track your projects</p>
                    <h1 className="text-[34px] font-extrabold text-[#000101] dark:text-white tracking-tight leading-none">
                        Project Dashboard
                    </h1>
                    <p className="text-[13px] text-gray-500 dark:text-zinc-500 mt-2">Welcome back, {displayName}</p>
                </div>
                <button
                    onClick={() => setIsDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold rounded-full bg-[#000101] dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm"
                >
                    + New Project
                </button>
                <CreateProjectDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            </div>

            {/* 3-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Column 1: My Tasks */}
                <div className="lg:col-span-3">
                    <MyTasksCard />
                </div>

                {/* Column 2: Projects Overview + Status */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <ProjectsOverviewCard />
                    <ProjectStatusCard />
                </div>

                {/* Column 3: Calendar + Activity */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <MiniCalendar />
                    <MyMeetingsCard />
                    <RecentActivity />
                </div>
            </div>
        </div>
    )
}

export default Dashboard
