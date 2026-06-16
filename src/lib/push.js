import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    const output = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
    return output
}

/** True if this device already has an active push subscription. */
export async function getSubscriptionState() {
    if (!pushSupported()) return { supported: false, subscribed: false, permission: 'unsupported' }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return { supported: true, subscribed: !!sub, permission: Notification.permission }
}

/** Request permission, subscribe, and persist the subscription for the given user. */
export async function subscribeToPush(userId) {
    if (!pushSupported()) throw new Error('Push not supported on this device')
    if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY is not set')

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Notification permission denied')

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
    }

    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
        {
            user_id: userId,
            endpoint: sub.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' },
    )
    if (error) throw error
    return true
}

/** Unsubscribe this device and remove its stored subscription. */
export async function unsubscribeFromPush() {
    if (!pushSupported()) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
}
