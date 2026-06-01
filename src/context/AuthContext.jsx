import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async (userId) => {
        if (!userId) { setProfile(null); return }
        const { data } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', userId)
            .single()
        if (data) setProfile(data)
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null
            setUser(u)
            fetchProfile(u?.id).finally(() => setLoading(false))
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const u = session?.user ?? null
            setUser(u)
            fetchProfile(u?.id)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signIn = (email, password) =>
        supabase.auth.signInWithPassword({ email, password })

    const signUp = (email, password) =>
        supabase.auth.signUp({ email, password })

    const signOut = () => supabase.auth.signOut()

    // Convenience: the best display name we have
    const displayName = profile?.name || user?.email?.split('@')[0] || 'there'

    return (
        <AuthContext.Provider value={{ user, profile, displayName, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within an AuthProvider')
    return context
}
