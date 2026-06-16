import { PanelLeft } from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import UserAvatar from './UserAvatar'
import NotificationBell from './NotificationBell'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const Navbar = ({ setIsSidebarOpen }) => {
    const { displayName, user } = useAuth()
    const navigate = useNavigate()
    const [avatarUrl, setAvatarUrl] = useState(null)

    useEffect(() => {
        if (!user?.id) return
        supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
            .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url) })
    }, [user?.id])

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

                {/* Search */}
                <div className="flex-1 min-w-0">
                    <GlobalSearch />
                </div>

                {/* Notifications */}
                <NotificationBell />

                {/* Avatar — links to settings */}
                <button onClick={() => navigate('/settings')} title="Settings"
                    className="hover:opacity-80 transition-opacity flex-shrink-0">
                    <UserAvatar name={displayName} avatarUrl={avatarUrl} size={32} />
                </button>
            </div>
        </div>
    )
}

export default Navbar
