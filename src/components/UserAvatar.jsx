/**
 * UserAvatar — shared component for all user avatar rendering.
 * Shows avatar_url photo if available, otherwise initials on a colored background.
 *
 * Props:
 *   name      string   — display name or email (used for initials + color)
 *   avatarUrl string   — direct URL (optional; falls back to initials)
 *   user      object   — { name, email, avatar_url } — alternative to name+avatarUrl
 *   size      number   — pixel size (default 28)
 *   className string   — extra classes
 */
export default function UserAvatar({ name, avatarUrl, user, size = 28, className = '' }) {
    const resolvedName     = user?.name || user?.email || name || '?'
    const resolvedAvatarUrl = user?.avatar_url || avatarUrl || null

    const initials = resolvedName
        .split(/[\s@.]+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    // Stable color from name so the same person always gets the same color
    const colors = [
        'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
        'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500',
    ]
    const colorIndex = [...resolvedName].reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length
    const bg = colors[colorIndex]

    const style = { width: size, height: size, flexShrink: 0 }
    const base  = `rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${className}`

    if (resolvedAvatarUrl) {
        return (
            <div style={style} className={base}>
                <img
                    src={resolvedAvatarUrl}
                    alt={resolvedName}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
            </div>
        )
    }

    const fontSize = Math.max(9, Math.round(size * 0.38))

    return (
        <div style={{ ...style, fontSize }} className={`${base} ${bg} text-white font-bold`}>
            {initials}
        </div>
    )
}
