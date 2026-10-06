import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "./supabase"
import { useAuth } from "../context/AuthContext"

// A per-person setting that follows them across devices.
//
// Saved in the user_prefs table (one row per person per key). The browser copy
// is kept too: it paints instantly, and it's the fallback if the table can't be
// reached, so the setting still works on this device. The first time a device
// finds nothing saved remotely, it uploads what it already had.
export function useSyncedPref(key, initial) {
    const { user } = useAuth()
    const userId = user?.id

    const readLocal = useCallback(() => {
        try {
            const raw = localStorage.getItem(key)
            return raw == null ? initial : JSON.parse(raw)
        } catch { return initial }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])

    const [value, setValue] = useState(readLocal)
    const latest = useRef(value)
    const timer = useRef(null)

    const writeLocal = (v) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

    const push = useCallback((v) => {
        if (!userId) return
        supabase.from("user_prefs")
            .upsert({ user_id: userId, key, value: v, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" })
            .then(({ error }) => { if (error) console.warn(`[prefs] "${key}" is saved on this device only:`, error.message) })
    }, [userId, key])

    useEffect(() => {
        const v = readLocal()
        latest.current = v
        setValue(v)
        if (!userId) return
        let on = true
        supabase.from("user_prefs").select("value").eq("user_id", userId).eq("key", key).maybeSingle()
            .then(({ data, error }) => {
                if (!on || error) return
                if (data) { latest.current = data.value; setValue(data.value); writeLocal(data.value) }
                else if (localStorage.getItem(key) != null) push(readLocal())
            })
        return () => { on = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, key])

    useEffect(() => () => clearTimeout(timer.current), [])

    const set = useCallback((next) => {
        const v = typeof next === "function" ? next(latest.current) : next
        latest.current = v
        setValue(v)
        writeLocal(v)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => push(v), 400)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, push])

    return [value, set]
}
