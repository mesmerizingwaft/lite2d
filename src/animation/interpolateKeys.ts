import type { AnimationKey } from '../editor/types'
export function interpolateKeys(keys: AnimationKey[], time: number): number {
  if (!keys.length) return 0
  const sorted = [...keys].sort((a, b) => a.time - b.time)
  if (time <= sorted[0].time) return sorted[0].value
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    if (time <= b.time) {
      if (a.interpolation === 'step') return a.value
      const t = (time - a.time) / Math.max(0.00001, b.time - a.time)
      return a.value + (b.value - a.value) * t
    }
  }
  return sorted[sorted.length - 1].value
}
