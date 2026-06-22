import { create } from 'zustand'
import { evaluateAnimation } from '../animation/evaluateAnimation'
import { PARAM_DEFORM_ID, type Animation, type Parameter, type Part, type Project, type Vec2 } from './types'

const parameters: Parameter[] = [{ id: PARAM_DEFORM_ID, name: 'ParamDeform', min: 0, max: 1, default: 0 }]
const animation: Animation = { fps: 12, duration: 1, tracks: [{ parameterId: PARAM_DEFORM_ID, keys: [{ time: 0, value: 0, interpolation: 'linear' }, { time: 0.5, value: 1, interpolation: 'linear' }, { time: 1, value: 0, interpolation: 'linear' }] }] }

type State = Project & { selectedPartId?: string; isPlaying: boolean; currentTime: number; addParts(parts: Part[]): void; selectPart(id: string): void; toggleVisible(id: string): void; movePart(id: string, dir: -1 | 1): void; setParameter(id: string, value: number): void; saveKeyform(value: 0 | 1): void; updatePartVertices(id: string, vertices: Vec2[]): void; play(): void; stop(): void; setTime(t: number): void }
export const useEditorStore = create<State>((set, get) => ({
  parts: [], parameters, parameterValues: { [PARAM_DEFORM_ID]: 0 }, animation, selectedPartId: undefined, isPlaying: false, currentTime: 0,
  addParts: parts => set(s => ({ parts: [...s.parts, ...parts], selectedPartId: parts.at(-1)?.id ?? s.selectedPartId })),
  selectPart: id => set({ selectedPartId: id }),
  toggleVisible: id => set(s => ({ parts: s.parts.map(p => p.id === id ? { ...p, visible: !p.visible } : p) })),
  movePart: (id, dir) => set(s => ({ parts: s.parts.map(p => p.id === id ? { ...p, zIndex: p.zIndex + dir } : p) })),
  setParameter: (id, value) => set(s => ({ parameterValues: { ...s.parameterValues, [id]: value } })),
  saveKeyform: value => set(s => ({ parts: s.parts.map(p => p.id === s.selectedPartId ? { ...p, keyforms: [...p.keyforms.filter(k => !(k.parameterId === PARAM_DEFORM_ID && k.value === value)), { parameterId: PARAM_DEFORM_ID, value, vertices: p.mesh.vertices.map(v => ({ ...v })) }] } : p) })),
  updatePartVertices: (id, vertices) => set(s => {
    const copied = vertices.map(v => ({ ...v }))
    const currentDeformValue = s.parameterValues[PARAM_DEFORM_ID]
    const keyformValue = currentDeformValue === 0 || currentDeformValue === 1 ? currentDeformValue : null
    return {
      parts: s.parts.map(p => {
        if (p.id !== id) return p

        let keyforms = p.keyforms
        if (keyformValue != null) {
          const updated = { parameterId: PARAM_DEFORM_ID, value: keyformValue, vertices: copied.map(v => ({ ...v })) }
          keyforms = p.keyforms.some(k => k.parameterId === PARAM_DEFORM_ID && k.value === keyformValue)
            ? p.keyforms.map(k => k.parameterId === PARAM_DEFORM_ID && k.value === keyformValue ? updated : k)
            : [...p.keyforms, updated]
        }

        return { ...p, mesh: { ...p.mesh, vertices: copied.map(v => ({ ...v })) }, keyforms }
      }),
    }
  }),
  play: () => set({ isPlaying: true }), stop: () => set({ isPlaying: false, currentTime: 0, parameterValues: { ...get().parameterValues, ...evaluateAnimation(get().animation, 0) } }),
  setTime: t => set(s => ({ currentTime: t, parameterValues: { ...s.parameterValues, ...evaluateAnimation(s.animation, t) } }))
}))
