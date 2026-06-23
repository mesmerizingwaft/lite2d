import { create } from 'zustand'
import { evaluateAnimation } from '../animation/evaluateAnimation'
import { evaluatePartVertices } from '../render/evaluateDeformation'
import { PARAM_DEFORM_ID, type Animation, type MeshData, type Parameter, type Part, type Project, type Vec2 } from './types'

const parameters: Parameter[] = [{ id: PARAM_DEFORM_ID, name: 'ParamDeform', min: 0, max: 1, default: 0 }]
const animation: Animation = { fps: 12, duration: 1, tracks: [{ parameterId: PARAM_DEFORM_ID, keys: [{ time: 0, value: 0, interpolation: 'linear' }, { time: 0.5, value: 1, interpolation: 'linear' }, { time: 1, value: 0, interpolation: 'linear' }] }] }

type State = Project & { selectedPartId?: string; editingPartId?: string; selectedMeshVertexIndices: number[]; isPlaying: boolean; currentTime: number; editVertices: Record<string, Vec2[]>; savedKeyform?: { partId: string; value: 0 | 1 }; addParts(parts: Part[]): void; selectPart(id: string): void; beginMeshEdit(id: string): void; endMeshEdit(): void; selectMeshVertices(indices?: number[]): void; updatePartMesh(id: string, mesh: MeshData, selectedMeshVertexIndices?: number[]): void; toggleVisible(id: string): void; movePart(id: string, dir: -1 | 1): void; setParameter(id: string, value: number): void; saveKeyform(value: 0 | 1): void; updatePartVertices(id: string, vertices: Vec2[]): void; play(): void; stop(): void; setTime(t: number): void }
export const useEditorStore = create<State>((set, get) => ({
  parts: [], parameters, parameterValues: { [PARAM_DEFORM_ID]: 0 }, animation, selectedPartId: undefined, editingPartId: undefined, selectedMeshVertexIndices: [], isPlaying: false, currentTime: 0, editVertices: {}, savedKeyform: undefined,
  addParts: parts => set(s => ({ parts: [...s.parts, ...parts], selectedPartId: parts.at(-1)?.id ?? s.selectedPartId, editingPartId: undefined, selectedMeshVertexIndices: [] })),
  selectPart: id => set({ selectedPartId: id, editingPartId: undefined, selectedMeshVertexIndices: [] }),
  beginMeshEdit: id => set({ selectedPartId: id, editingPartId: id, selectedMeshVertexIndices: [], isPlaying: false, editVertices: {}, savedKeyform: undefined }),
  endMeshEdit: () => set({ editingPartId: undefined, selectedMeshVertexIndices: [] }),
  selectMeshVertices: indices => set({ selectedMeshVertexIndices: indices ?? [] }),
  updatePartMesh: (id, mesh, selectedMeshVertexIndices) => set(s => ({
    parts: s.parts.map(p => p.id === id ? { ...p, mesh, keyforms: [{ parameterId: PARAM_DEFORM_ID, value: 0, vertices: mesh.vertices.map(v => ({ ...v })) }] } : p),
    editVertices: Object.fromEntries(Object.entries(s.editVertices).filter(([partId]) => partId !== id)),
    selectedMeshVertexIndices: selectedMeshVertexIndices ?? [],
    savedKeyform: undefined,
  })),
  toggleVisible: id => set(s => ({ parts: s.parts.map(p => p.id === id ? { ...p, visible: !p.visible } : p) })),
  movePart: (id, dir) => set(s => ({ parts: s.parts.map(p => p.id === id ? { ...p, zIndex: p.zIndex + dir } : p) })),
  setParameter: (id, value) => set(s => ({ parameterValues: { ...s.parameterValues, [id]: value }, editVertices: {}, savedKeyform: undefined })),
  saveKeyform: value => set(s => {
    const selectedPart = s.parts.find(p => p.id === s.selectedPartId)
    if (!selectedPart) return s
    const vertices = (s.editVertices[selectedPart.id] ?? evaluatePartVertices(selectedPart, s.parameterValues)).map(v => ({ ...v }))
    return {
      parts: s.parts.map(p => p.id === selectedPart.id ? { ...p, keyforms: [...p.keyforms.filter(k => !(k.parameterId === PARAM_DEFORM_ID && k.value === value)), { parameterId: PARAM_DEFORM_ID, value, vertices }] } : p),
      savedKeyform: { partId: selectedPart.id, value },
    }
  }),
  updatePartVertices: (id, vertices) => set(s => ({ editVertices: { ...s.editVertices, [id]: vertices.map(v => ({ ...v })) }, savedKeyform: undefined })),
  play: () => set({ isPlaying: true, editingPartId: undefined, editVertices: {}, savedKeyform: undefined }),
  stop: () => set({ isPlaying: false, currentTime: 0, editVertices: {}, savedKeyform: undefined, parameterValues: { ...get().parameterValues, ...evaluateAnimation(get().animation, 0) } }),
  setTime: t => set(s => ({ currentTime: t, parameterValues: { ...s.parameterValues, ...evaluateAnimation(s.animation, t) } }))
}))
