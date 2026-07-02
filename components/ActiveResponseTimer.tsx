import { ACTIVE_RESPONSE_CONFIG } from '@/core/activeResponse'

interface ActiveResponseTimerProps {
  timerMs: number
  /** 応答権が自分にあるか */
  isMyPriority: boolean
}

/**
 * アクティブレスポンスの応答残り時間（アクションカード1枚につき10秒）。
 * 応答権の所在と残り秒数・バーを表示する。
 */
export default function ActiveResponseTimer({ timerMs, isMyPriority }: ActiveResponseTimerProps) {
  const seconds = Math.max(0, Math.ceil(timerMs / 1000))
  const ratio = Math.max(0, Math.min(1, timerMs / ACTIVE_RESPONSE_CONFIG.TIMER_MS))
  const urgent = timerMs <= 3000

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`text-[10px] ls:text-[8px] font-bold tracking-wider whitespace-nowrap ${
          isMyPriority ? 'text-amber-300' : 'text-white/55'
        }`}
      >
        {isMyPriority ? 'あなたの応答時間' : '相手の応答時間'}
      </div>
      <div
        className={`font-orbitron font-black text-2xl ls:text-base leading-none tabular-nums ${
          urgent ? 'text-red-400 animate-pulse' : 'text-cyan-100'
        }`}
      >
        {seconds}
      </div>
      <div className="h-1 w-24 ls:w-14 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full transition-[width] duration-150 ${
            urgent ? 'bg-red-400' : 'bg-gradient-to-r from-cyan-400 to-cyan-200'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
