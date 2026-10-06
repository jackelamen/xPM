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

    // One-time carry-over of the old browser-only toggle.
    const migrated = useRef(false)
    useEffect(() => {
        if (!user || migrated.current || user.user_metadata?.pulse !== undefined) return
        migrated.current = true
        try {
            if (JSON.parse(localStorage.getItem(PULSE_LEGACY_KEY)) === true) updatePulse({ enabled: true }).catch(() => {})
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
        <AuthContext.Provider value={{ user, profile, displayName, isSuperadmin: !!profile?.is_superadmin, pulse, updatePulse, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within an AuthProvider')
    return context
}
