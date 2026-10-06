import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PULSE_LEGACY_KEY, AUTO_SEND_DEFAULT_DAYS } from '../lib/pulse'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async (userId) => {
        if (!userId) { setProfile(null); return }
        const { data } = await supabase
            .from('profiles')
            .select('name, email, is_superadmin')
            .eq('id', userId)
            .single()
        if (data) setProfile(data)
    }

    useEffect(() => {
        // Safety net — never spin forever on slow/offline mobile connections
        const timeout = setTimeout(() => setLoading(false), 5000)

        supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null
            setUser(u)
            fetchProfile(u?.id).finally(() => {
                clearTimeout(timeout)
                setLoading(false)
            })
        }).catch(() => {
            clearTimeout(timeout)
            setLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const u = session?.user ?? null
            setUser(u)
            fetchProfile(u?.id)
        })

        return () => {
            clearTimeout(timeout)
            subscription.unsubscribe()
        }
    }, [])

    // Pulse prefs live in auth user metadata so they follow the person across
    // devices (they used to be browser-only). Only the signed-in user's own
    // metadata is read or written.
    const pulse = useMemo(() => {
        const m = user?.user_metadata?.pulse || {}
        return {
            enabled: !!m.enabled,
            autoSend: !!m.auto_send,
            days: Number.isFinite(m.days) ? m.days : AUTO_SEND_DEFAULT_DAYS,
        }
    }, [user])

    const updatePulse = async (patch) => {
        const cur = user?.user_metadata?.pulse || {}
        const { data, error } = await supabase.auth.updateUser({ data: { pulse: { ...cur, ...patch } } })
        if (error) throw error
        if (data?.user) setUser(data.user)
    }

    // Weekly ritual state: { planned: <Monday of the planned week>, reviewed: <Monday> }.
    // Saved to the account so it's the same on every device.
    const rituals = user?.user_metadata?.rituals || {}
    const markRitual = async (patch) => {
        const { data, error } = await supabase.auth.updateUser({ data: { rituals: { ...(user?.user_metadata?.rituals || {}), ...patch } } })
        if (error) throw error
        if (data?.user) setUser(data.user)
    }

    // Small settings that change behaviour (auto-archive) or layout (My Tasks view).
    // Kept in user metadata, so they must stay tiny; bigger ones use user_prefs.
    const prefs = useMemo(() => {
        const m = user?.user_metadata?.prefs || {}
        return { autoArchive: m.auto_archive || { enabled: false, days: 7 }, myTasksView: m.mytasks_view || 'list' }
    }, [user])

    const updatePrefs = async (patch) => {
        const cur = user?.user_metadata?.prefs || {}
        const { data, error } = await supabase.auth.updateUser({ data: { prefs: { ...cur, ...patch } } })
        if (error) throw error
        if (data?.user) setUser(data.user)
    }

    // One-time carry-over of settings that used to live only in this browser.
    const migrated = useRef(false)
    useEffect(() => {
        if (!user || migrated.current) return
        migrated.current = true
        const meta = user.user_metadata || {}
        try {
            if (meta.pulse === undefined && JSON.parse(localStorage.getItem(PULSE_LEGACY_KEY)) === true) updatePulse({ enabled: true }).catch(() => {})
            if (meta.prefs?.auto_archive === undefined) {
                const old = JSON.parse(localStorage.getItem('xpm_auto_archive'))
                if (old?.enabled) updatePrefs({ auto_archive: old }).catch(() => {})
            }
        } catch { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    const signIn = (email, password) =>
        supabase.auth.signInWithPassword({ email, password })

    const signUp = (email, password) =>
        supabase.auth.signUp({ email, password })

    const signOut = () => supabase.auth.signOut()

    // Convenience: the best display name we have
    const displayName = profile?.name || user?.email?.split('@')[0] || 'there'

    return (
        <AuthContext.Provider value={{ user, profile, displayName, isSuperadmin: !!profile?.is_superadmin, pulse, updatePulse, rituals, markRitual, prefs, updatePrefs, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within an AuthProvider')
    return context
}
