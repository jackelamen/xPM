import { useSearchParams } from 'react-router-dom'
import WeekPlan from '../components/WeekPlan'
import WeekReview from '../components/WeekReview'

// The weekly loop: plan on Monday, review on Friday.
export default function Week() {
    const [params, setParams] = useSearchParams()
    const dow = new Date().getDay()
    const tab = params.get('tab') || (dow === 5 || dow === 6 || dow === 0 ? 'review' : 'plan')
    const weekKind = params.get('week') === 'next' ? 'next' : 'this'
    const go = (next) => setParams(next, { replace: true })

    return (
        <div className="max-w-[1200px] mx-auto">
            <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-zinc-800">
                {[['plan', 'Plan'], ['review', 'Review']].map(([k, label]) => (
                    <button key={k} onClick={() => go({ tab: k })}
                        className={`px-4 py-2.5 text-[14px] -mb-px border-b-2 ${tab === k ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white font-medium' : 'border-transparent text-gray-500 dark:text-zinc-400'}`}>
                        {label}
                    </button>
                ))}
            </div>
            {tab === 'review'
                ? <WeekReview onPlanNext={() => go({ tab: 'plan', week: 'next' })} />
                : <WeekPlan weekKind={weekKind} onWeekKind={(w) => go({ tab: 'plan', week: w })} />}
        </div>
    )
}
