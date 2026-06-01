import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDispatch, useSelector } from 'react-redux'
import { Loader2Icon, SaveIcon, LogOutIcon, SunIcon, MoonIcon, ArchiveIcon, ZapIcon, UploadIcon, BuildingIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { clearWorkspaces, fetchWorkspaces } from '../features/workspaceSlice'
import { toggleTheme } from '../features/themeSlice'

export const AUTO_ARCHIVE_KEY = 'xpm_auto_archive'
export const PULSE_KEY = 'xpm_pulse_enabled'

export function getPulseEnabled() {
    try { return JSON.parse(localStorage.getItem(PULSE_KEY)) === true }
    catch { return false }
}

export function getAutoArchiveSetting() {
    try { return JSON.parse(localStorage.getItem(AUTO_ARCHIVE_KEY)) || { enabled: false, days: 7 } }
    catch { return { enabled: false, days: 7 } }
}

const inputClasses = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 mt-1.5 placeholder:text-gray-400"
const labelClasses = "text-[12px] font-medium text-gray-600 dark:text-zinc-400"

function Section({ title, description, children }) {
    return (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/[0.07] rounded-2xl p-6">
            <div className="mb-5">
                <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white">{title}</h2>
                {description && <p className="text-[12px] text-gray-500 dark:text-zinc-500 mt-0.5">{description}</p>}
            </div>
            {children}
        </div>
    )
}

function WorkspaceSettings() {
    const currentWorkspace = useSelector((state) => state.workspace.currentWorkspace)
    const dispatch = useDispatch()
    const [wsName, setWsName] = useState('')
    const [iconUrl, setIconUrl] = useState('')
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const fileRef = useRef()

    useEffect(() => {
        if (currentWorkspace) {
            setWsName(currentWorkspace.name || '')
            setIconUrl(currentWorkspace.icon_url || '')
        }
    }, [currentWorkspace])

    const handleIconUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !currentWorkspace) return
        setUploading(true)
        try {
            const ext = file.name.split('.').pop()
            const path = `workspaces/${currentWorkspace.id}/icon.${ext}`
            const { error: upErr } = await supabase.storage
                .from('workspace-assets')
                .upload(path, file, { upsert: true })
            if (upErr) throw upErr
            const { data } = supabase.storage.from('workspace-assets').getPublicUrl(path)
            const url = data.publicUrl + '?t=' + Date.now()
            const { error: dbErr } = await supabase
                .from('workspaces')
                .update({ icon_url: url })
                .eq('id', currentWorkspace.id)
            if (dbErr) throw dbErr
            setIconUrl(url)
            dispatch(fetchWorkspaces())
            toast.success('Workspace icon updated')
        } catch (err) {
            toast.error(err.message || 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    const handleSaveName = async (e) => {
        e.preventDefault()
        if (!wsName.trim() || !currentWorkspace) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('workspaces')
                .update({ name: wsName.trim() })
                .eq('id', currentWorkspace.id)
            if (error) throw error
            dispatch(fetchWorkspaces())
            toast.success('Workspace updated')
        } catch (err) {
            toast.error(err.message || 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    if (!currentWorkspace) return null

    return (
        <Section title="Workspace" description="Settings for your current workspace.">
            {/* Icon upload */}
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.06]">
                <div className="relative group flex-shrink-0">
                    <div
                        onClick={() => fileRef.current?.click()}
                        className="size-14 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/[0.12] bg-gray-50 dark:bg-white/[0.03] flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 dark:hover:border-white/30 transition-colors"
                    >
                        {uploading ? (
                            <Loader2Icon className="size-5 animate-spin text-gray-400" />
                        ) : iconUrl ? (
                            <img src={iconUrl} alt="workspace icon" className="w-full h-full object-cover" />
                        ) : (
                            <BuildingIcon className="size-5 text-gray-300 dark:text-zinc-600" />
                        )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center pointer-events-none">
                        <UploadIcon className="size-2.5 text-white dark:text-gray-900" />
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                </div>
                <div>
                    <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100">{currentWorkspace.name}</p>
                    <p className="text-[12px] text-gray-400 dark:text-zinc-500 mt-0.5">Click the icon to upload a new one</p>
                </div>
            </div>

            {/* Name */}
            <form onSubmit={handleSaveName} className="space-y-4">
                <div>
                    <label className={labelClasses}>Workspace name</label>
                    <input
                        type="text"
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        className={inputClasses}
                        placeholder="My Workspace"
                    />
                </div>
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                    {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : <SaveIcon className="size-3.5" />}
                    {saving ? 'Saving...' : 'Save changes'}
                </button>
            </form>
        </Section>
    )
}

export default function ProfileSettings() {
    const { user, signOut, displayName: contextDisplayName } = useAuth()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { theme } = useSelector((state) => state.theme)

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    const [autoArchive, setAutoArchive] = useState(getAutoArchiveSetting)
    const [pulseEnabled, setPulseEnabled] = useState(getPulseEnabled)

    const saveAutoArchive = (next) => {
        setAutoArchive(next)
        localStorage.setItem(AUTO_ARCHIVE_KEY, JSON.stringify(next))
        toast.success(next.enabled ? `Auto-archive enabled (${next.days} days)` : 'Auto-archive disabled')
    }

    const togglePulse = (val) => {
        localStorage.setItem(PULSE_KEY, JSON.stringify(val))
        setPulseEnabled(val)
        toast.success(val ? 'Pulse integration enabled' : 'Pulse integration disabled')
    }

    useEffect(() => {
        if (!user) return
        supabase
            .from('profiles')
            .select('name, email')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                if (data) {
                    setName(data.name || '')
                    setEmail(data.email || user.email || '')
                }
                setLoading(false)
            })
    }, [user])

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ name: name.trim(), updated_at: new Date().toISOString() })
                .eq('id', user.id)
            if (error) throw error
            toast.success('Profile updated')
        } catch (err) {
            toast.error(err.message || 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleSignOut = async () => {
        await signOut()
        dispatch(clearWorkspaces())
        navigate('/login')
        toast.success('Signed out')
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2Icon className="size-5 animate-spin text-gray-400" />
        </div>
    )

    const initials = (name || contextDisplayName || '?')[0].toUpperCase()

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-8">
            {/* Page title */}
            <div className="mb-6">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Settings</h1>
                <p className="text-[13px] text-gray-400 dark:text-zinc-500 mt-0.5">Manage your account and preferences</p>
            </div>

            {/* Profile card */}
            <Section title="Profile" description="Your public display name and account email.">
                {/* Avatar row */}
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.06]">
                    <div className="size-14 rounded-full bg-gray-900 dark:bg-zinc-200 flex items-center justify-center text-white dark:text-gray-900 text-xl font-bold flex-shrink-0">
                        {initials}
                    </div>
                    <div>
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-zinc-100">{name || email}</p>
                        <p className="text-[12px] text-gray-400 dark:text-zinc-500">{email}</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Display name</label>
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
                            className={inputClasses + ' opacity-50 cursor-not-allowed'}
                        />
                        <p className="text-[11px] text-gray-400 dark:text-zinc-600 mt-1">Email cannot be changed here.</p>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : <SaveIcon className="size-3.5" />}
                        {saving ? 'Saving...' : 'Save changes'}
                    </button>
                </form>
            </Section>

            {/* Appearance */}
            <Section title="Appearance" description="Choose how xPM looks for you.">
                <div className="flex gap-3">
                    {[
                        { value: 'light', label: 'Light', icon: SunIcon },
                        { value: 'dark',  label: 'Dark',  icon: MoonIcon },
                    ].map(({ value, label, icon: Icon }) => (
                        <button
                            key={value}
                            onClick={() => { if (theme !== value) dispatch(toggleTheme()) }}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-[13px] font-medium transition-all ${
                                theme === value
                                    ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                                    : 'border-gray-200 dark:border-white/[0.1] text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-white/[0.05]'
                            }`}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>
            </Section>

            {/* Automation */}
            <Section title="Automation" description="Rules that run automatically in the background.">
                <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <ArchiveIcon size={13} className="text-zinc-500 dark:text-zinc-400" />
                            <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100">Auto-archive completed tasks</p>
                        </div>
                        <p className="text-[12px] text-gray-500 dark:text-zinc-500">
                            Automatically archive tasks marked as Done after a set number of days.
                        </p>
                        {autoArchive.enabled && (
                            <div className="flex items-center gap-2 mt-3">
                                <span className="text-[12px] text-gray-600 dark:text-zinc-400">Archive after</span>
                                <select
                                    value={autoArchive.days}
                                    onChange={(e) => saveAutoArchive({ ...autoArchive, days: Number(e.target.value) })}
                                    className="text-[12px] border border-gray-200 dark:border-white/[0.1] rounded-md px-2 py-1 bg-white dark:bg-white/[0.04] text-gray-900 dark:text-zinc-100 outline-none cursor-pointer"
                                >
                                    {[1, 2, 3, 5, 7, 14, 30].map((d) => (
                                        <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>
                                    ))}
                                </select>
                                <span className="text-[12px] text-gray-600 dark:text-zinc-400">of completion</span>
                            </div>
                        )}
                    </div>
                    {/* Toggle */}
                    <button
                        onClick={() => saveAutoArchive({ ...autoArchive, enabled: !autoArchive.enabled })}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none mt-0.5 ${
                            autoArchive.enabled ? 'bg-zinc-900 dark:bg-white' : 'bg-gray-200 dark:bg-zinc-700'
                        }`}
                        role="switch"
                        aria-checked={autoArchive.enabled}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow transition-transform duration-200 ${
                            autoArchive.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                    </button>
                </div>
            </Section>

            {/* Pulse Integration */}
            <Section title="Pulse Integration" description="Enable if you have access to Pulse, the EDGEx daily planner. Adds a 'Send to Pulse' field in My Tasks.">
                <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <ZapIcon size={13} className="text-violet-500" />
                            <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100">Enable Pulse integration</p>
                        </div>
                        <p className="text-[12px] text-gray-500 dark:text-zinc-500">
                            Pulse and xPM share the same account — no login required. Once enabled, the "Send to Pulse" column becomes available in My Tasks via the Fields picker.
                        </p>
                        {pulseEnabled && (
                            <p className="text-[12px] text-violet-600 dark:text-violet-400 mt-2 flex items-center gap-1.5">
                                <ZapIcon size={11} /> Active — open the Fields picker in My Tasks to show "Send to Pulse"
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => togglePulse(!pulseEnabled)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none mt-0.5 ${
                            pulseEnabled ? 'bg-violet-500' : 'bg-gray-200 dark:bg-zinc-700'
                        }`}
                        role="switch"
                        aria-checked={pulseEnabled}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                            pulseEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                    </button>
                </div>
            </Section>

            {/* Workspace Settings */}
            <WorkspaceSettings />

            <div className="border-t border-gray-200 dark:border-white/[0.07]" />

            {/* Session */}
            <Section title="Session" description="Sign out of your account on this device.">
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-[13px] font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                    <LogOutIcon size={13} />
                    Sign out
                </button>
            </Section>
        </div>
    )
}
