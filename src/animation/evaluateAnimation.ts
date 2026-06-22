import type { Animation } from '../editor/types'
import { interpolateKeys } from './interpolateKeys'
export function evaluateAnimation(animation: Animation, time: number): Record<string, number> {
  const t = ((time % animation.duration) + animation.duration) % animation.duration
  return Object.fromEntries(animation.tracks.map(track => [track.parameterId, interpolateKeys(track.keys, t)]))
}
