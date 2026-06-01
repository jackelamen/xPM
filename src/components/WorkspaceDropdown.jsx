import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus, Loader2Icon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentWorkspace, fetchWorkspaceDetail, createWorkspace } from "../features/workspaceSlice";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

function WorkspaceAvatar({ name, iconUrl, size = "sm" }) {
    const initials = name?.slice(0, 2).toUpperCase() || "WS"
    const sizeClass = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[11px]"
    if (iconUrl) return (
        <img src={iconUrl} alt={name} className={`${sizeClass} rounded-md object-cover flex-shrink-0`} />
    )
    return (
        <div className={`${sizeClass} rounded-md bg-gray-900 dark:bg-zinc-200 flex items-center justify-center text-white dark:text-zinc-900 font-bold flex-shrink-0 tracking-tight`}>
            {initials}
        </div>
    )
}

function WorkspaceDropdown() {
    const { workspaces, currentWorkspace } = useSelector((state) => state.workspace);
    const [isOpen, setIsOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newWsName, setNewWsName] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const dropdownRef = useRef(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useAuth();

    const onSelectWorkspace = async (wsId) => {
        if (currentWorkspace?.id === wsId) { setIsOpen(false); return }
        dispatch(setCurrentWorkspace(wsId))
        setIsOpen(false)
        navigate('/')
        // Small delay so Redux state settles before fetching detail
        setTimeout(() => dispatch(fetchWorkspaceDetail(wsId)), 50)
    }

    const handleCreateWorkspace = async (e) => {
        e.preventDefault()
        if (!newWsName.trim()) return
        setCreating(true)
        try {
            await dispatch(createWorkspace({ name: newWsName.trim(), userId: user.id })).unwrap()
            toast.success("Workspace created!")
            setNewWsName("")
            setShowCreate(false)
            setIsOpen(false)
            navigate('/')
        } catch (err) {
            toast.error(err || "Failed to create workspace")
        } finally {
            setCreating(false)
        }
    }

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative px-3 py-2.5" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors text-left"
            >
                <WorkspaceAvatar name={currentWorkspace?.name} iconUrl={currentWorkspace?.icon_url} size="lg" />
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-[13px] truncate leading-tight">
                        {currentWorkspace?.name || "Select Workspace"}
                    </p>

                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-60 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/[0.08] rounded-lg shadow-xl shadow-black/10 top-full left-3 mt-1">
                    <div className="p-1.5">
                        <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 px-2 pt-1">
                            Workspaces
                        </p>
                        {workspaces.map((ws) => (
                            <div
                                key={ws.id}
                                onClick={() => onSelectWorkspace(ws.id)}
                                className="flex items-center gap-2.5 px-2 py-2 cursor-pointer rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                            >
                                <WorkspaceAvatar name={ws.name} iconUrl={ws.icon_url} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-gray-800 dark:text-zinc-100 truncate">
                                        {ws.name}
                                    </p>
                                </div>
                                {currentWorkspace?.id === ws.id && (
                                    <Check className="w-3.5 h-3.5 text-gray-900 dark:text-zinc-200 flex-shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-100 dark:border-white/[0.06] p-1.5">
                        {showCreate ? (
                            <form onSubmit={handleCreateWorkspace} className="flex gap-1.5 px-1">
                                <input
                                    autoFocus
                                    value={newWsName}
                                    onChange={(e) => setNewWsName(e.target.value)}
                                    placeholder="Workspace name"
                                    className="flex-1 text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20"
                                />
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-2.5 py-1.5 rounded-md bg-gray-900 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium disabled:opacity-50"
                                >
                                    {creating ? <Loader2Icon className="size-3 animate-spin" /> : "Add"}
                                </button>
                            </form>
                        ) : (
                            <button
                                onClick={() => setShowCreate(true)}
                                className="flex items-center text-[12px] gap-1.5 w-full text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add workspace
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkspaceDropdown;
