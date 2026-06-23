import { useEditorStore } from '../editor/store'
import type { Part } from '../editor/types'
import { rebuildMeshFromVertices } from '../mesh/rebuildMesh'
import { importPngParts } from '../project/importPngParts'
export function PartsPanel() {
  const { parts, selectedPartId, editingPartId, selectedMeshVertexIndices, addParts, selectPart, beginMeshEdit, endMeshEdit, updatePartMesh, toggleVisible, movePart } = useEditorStore()
  const editingPart = parts.find(part => part.id === editingPartId)
  const selectedVertexCount = selectedMeshVertexIndices.length
  const canDeleteSelected = Boolean(editingPart && selectedVertexCount > 0 && canDeleteMeshVertices(editingPart, selectedMeshVertexIndices))
  const deleteSelectedVertex = () => {
    if (!editingPart || !canDeleteSelected) return
    const selected = new Set(selectedMeshVertexIndices)
    const vertices = editingPart.mesh.vertices.filter((_, i) => !selected.has(i))
    updatePartMesh(editingPart.id, rebuildMeshFromVertices(editingPart.width, editingPart.height, vertices), [])
  }
  return <section className="panel"><h2>Parts</h2><input type="file" accept="image/png" multiple onChange={async e => { const input = e.currentTarget; const files = [...(input.files ?? [])]; addParts(await importPngParts(files, parts.length)); input.value = '' }} />
    {editingPart && <div className="edit-banner"><span>Editing mesh: {editingPart.name}{selectedVertexCount > 0 ? ` (${selectedVertexCount} selected)` : ''}</span><button disabled={!canDeleteSelected} onClick={deleteSelectedVertex}>Delete Vertex</button><button onClick={endMeshEdit}>Done</button></div>}
    <div className="list">{[...parts].sort((a,b)=>b.zIndex-a.zIndex).map(p => <div key={p.id} className={'part '+(p.id===selectedPartId?'selected ':'')+(p.id===editingPartId?'editing':'')} onClick={() => selectPart(p.id)}>
      <button onClick={e => { e.stopPropagation(); toggleVisible(p.id) }}>{p.visible ? 'Hide' : 'Show'}</button><span>{p.name}</span><small>z:{p.zIndex}</small><button onClick={e=>{e.stopPropagation(); p.id === editingPartId ? endMeshEdit() : beginMeshEdit(p.id)}}>{p.id === editingPartId ? 'Done' : 'Edit'}</button><button onClick={e=>{e.stopPropagation();movePart(p.id,1)}}>Up</button><button onClick={e=>{e.stopPropagation();movePart(p.id,-1)}}>Down</button>
    </div>)}</div></section>
}

function canDeleteMeshVertices(part: Part, indices: number[]) {
  const uniqueIndices = new Set(indices)
  return uniqueIndices.size > 0 && part.mesh.vertices.length - uniqueIndices.size >= 3 && [...uniqueIndices].every(index => index >= 0 && index < part.mesh.vertices.length)
}
