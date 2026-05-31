import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus, Loader2Icon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentWorkspace, fetchWorkspaceDetail, createWorkspace } from "../features/workspaceSlice";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

function WorkspaceAvatar({ name, size = "sm" }) {
    const initials = name?.slice(0, 2).toUpperCase() || "WS"
    const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"
    return (
        <div className={`${sizeClass} rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
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

    const onSelectWorkspace = (wsId) => {
        dispatch(setCurrentWorkspace(wsId))
        dispatch(fetchWorkspaceDetail(wsId))
        setIsOpen(false)
        navigate('/')
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
        <div className="relative m-4" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between p-2 h-auto text-left rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <WorkspaceAvatar name={currentWorkspace?.name} size="lg" />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                            {currentWorkspace?.name || "Select Workspace"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                            {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-400 flex-shrink-0 ml-2" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded shadow-lg top-full left-0">
                    <div className="p-2">
                        <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2 px-2">
                            Workspaces
                        </p>
                        {workspaces.map((ws) => (
                            <div
                                key={ws.id}
                                onClick={() => onSelectWorkspace(ws.id)}
                                className="flex items-center gap-3 p-2 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
                            >
                                <WorkspaceAvatar name={ws.name} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                        {ws.name}
                                    </p>
                                </div>
                                {currentWorkspace?.id === ws.id && (
                                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>

                    <hr className="border-gray-200 dark:border-zinc-700" />

                    <div className="p-2">
                        {showCreate ? (
                            <form onSubmit={handleCreateWorkspace} className="flex gap-1">
                                <input
                                    autoFocus
                                    value={newWsName}
                                    onChange={(e) => setNewWsName(e.target.value)}
                                    placeholder="Workspace name"
                                    className="flex-1 text-xs px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-2 py-1.5 rounded bg-blue-500 text-white text-xs disabled:opacity-60"
                                >
                                    {creating ? <Loader2Icon className="size-3 animate-spin" /> : "Add"}
                                </button>
                            </form>
                        ) : (
                            <button
                                onClick={() => setShowCreate(true)}
                                className="flex items-center text-xs gap-2 my-1 w-full text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
                            >
                                <Plus className="w-4 h-4" /> Create Workspace
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkspaceDropdown;
