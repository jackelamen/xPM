import { PanelLeft } from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const Navbar = ({ setIsSidebarOpen }) => {
    const { displayName } = useAuth()
    const navigate = useNavigate()

    const initials = displayName.charAt(0).toUpperCase()

    return (
        <div className="w-full bg-white/60 dark:bg-black/30 backdrop-blur-xl border-b border-white/50 dark:border-white/[0.06] px-5 py-2 flex-shrink-0 sticky top-0 z-40">
            <div className="flex items-center justify-between gap-4">

                {/* Mobile hamburger */}
                <button
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    className="sm:hidden p-1.5 rounded-md text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
                >
                    <PanelLeft size={16} />
                </button>

                {/* Search — takes remaining space */}
                <div className="flex-1 min-w-0">
                    <GlobalSearch />
                </div>

                {/* Avatar — links to settings */}
                <button
                    onClick={() => navigate('/settings')}
                    className="size-8 rounded-full bg-gray-900 dark:bg-zinc-200 flex items-center justify-center text-white dark:text-gray-900 text-[12px] font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
                    title="Settings"
                >
                    {initials}
                </button>
            </div>
        </div>
    )
}

export default Navbar
