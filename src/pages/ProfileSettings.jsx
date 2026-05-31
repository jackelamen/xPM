import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Loader2Icon, SaveIcon, LogOutIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { clearWorkspaces } from "../features/workspaceSlice";

const inputClasses = "w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1";
const labelClasses = "text-sm text-zinc-600 dark:text-zinc-400";

export default function ProfileSettings() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        supabase
            .from("profiles")
            .select("name, email")
            .eq("id", user.id)
            .single()
            .then(({ data }) => {
                if (data) {
                    setName(data.name || "");
                    setEmail(data.email || user.email || "");
                }
                setLoading(false);
            });
    }, [user]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ name: name.trim(), updated_at: new Date().toISOString() })
                .eq("id", user.id);

            if (error) throw error;
            toast.success("Profile updated");
        } catch (err) {
            toast.error(err.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        dispatch(clearWorkspaces());
        navigate("/login");
        toast.success("Signed out");
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2Icon className="size-6 animate-spin text-zinc-400" />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Profile Settings</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage your account details</p>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4">
                <div className="size-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-semibold">
                    {(name || email || "?")[0].toUpperCase()}
                </div>
                <div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{name || email}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{email}</p>
                </div>
            </div>

            {/* Profile Form */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50">
                <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-200 mb-4">Personal Information</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Display Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputClasses}
                            placeholder="Your name"
                        />
                    </div>
                    <div>
                        <label className={labelClasses}>Email</label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className={inputClasses + " opacity-60 cursor-not-allowed"}
                        />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Email cannot be changed here.</p>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm disabled:opacity-60 hover:opacity-90 transition"
                    >
                        {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>

            {/* Sign Out */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50">
                <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-200 mb-1">Session</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Sign out of your account on this device.</p>
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                    <LogOutIcon className="size-4" />
                    Sign out
                </button>
            </div>
        </div>
    );
}
