import { useEditorStore } from '../editor/store'
import type { Part } from '../editor/types'
import { rebuildMeshFromVertices } from '../mesh/rebuildMesh'
import { importPngParts } from '../project/importPngParts'
export function PartsPanel() {
  const { parts, selectedPartId, editingPartId, selectedMeshVertexIndex, addParts, selectPart, beginMeshEdit, endMeshEdit, updatePartMesh, toggleVisible, movePart } = useEditorStore()
  const editingPart = parts.find(part => part.id === editingPartId)
  const canDeleteSelected = editingPart && selectedMeshVertexIndex != null && canDeleteMeshVertex(editingPart, selectedMeshVertexIndex)
  const deleteSelectedVertex = () => {
    if (!editingPart || selectedMeshVertexIndex == null || !canDeleteSelected) return
    const vertices = editingPart.mesh.vertices.filter((_, i) => i !== selectedMeshVertexIndex)
    updatePartMesh(editingPart.id, rebuildMeshFromVertices(editingPart.width, editingPart.height, vertices), undefined)
  }
  return <section className="panel"><h2>Parts</h2><input type="file" accept="image/png" multiple onChange={async e => { const input = e.currentTarget; const files = [...(input.files ?? [])]; addParts(await importPngParts(files, parts.length)); input.value = '' }} />
    {editingPart && <div className="edit-banner"><span>Editing mesh: {editingPart.name}</span><button disabled={!canDeleteSelected} onClick={deleteSelectedVertex}>Delete Vertex</button><button onClick={endMeshEdit}>Done</button></div>}
    <div className="list">{[...parts].sort((a,b)=>b.zIndex-a.zIndex).map(p => <div key={p.id} className={'part '+(p.id===selectedPartId?'selected ':'')+(p.id===editingPartId?'editing':'')} onClick={() => selectPart(p.id)}>
      <button onClick={e => { e.stopPropagation(); toggleVisible(p.id) }}>{p.visible ? 'Hide' : 'Show'}</button><span>{p.name}</span><small>z:{p.zIndex}</small><button onClick={e=>{e.stopPropagation(); p.id === editingPartId ? endMeshEdit() : beginMeshEdit(p.id)}}>{p.id === editingPartId ? 'Done' : 'Edit'}</button><button onClick={e=>{e.stopPropagation();movePart(p.id,1)}}>Up</button><button onClick={e=>{e.stopPropagation();movePart(p.id,-1)}}>Down</button>
    </div>)}</div></section>
}

function canDeleteMeshVertex(part: Part, index: number) {
  if (part.mesh.vertices.length <= 4) return false
  const vertex = part.mesh.vertices[index]
  if (!vertex) return false
  const isCornerX = Math.abs(vertex.x) < 0.5 || Math.abs(vertex.x - part.width) < 0.5
  const isCornerY = Math.abs(vertex.y) < 0.5 || Math.abs(vertex.y - part.height) < 0.5
  return !(isCornerX && isCornerY)
}
