import { useEditorStore } from '../editor/store'
import { importPngParts } from '../project/importPngParts'
export function PartsPanel() {
  const { parts, selectedPartId, addParts, selectPart, toggleVisible, movePart } = useEditorStore()
  return <section className="panel"><h2>Parts</h2><input type="file" accept="image/png" multiple onChange={async e => { const input = e.currentTarget; const files = [...(input.files ?? [])]; addParts(await importPngParts(files, parts.length)); input.value = '' }} />
    <div className="list">{[...parts].sort((a,b)=>b.zIndex-a.zIndex).map(p => <div key={p.id} className={'part '+(p.id===selectedPartId?'selected':'')} onClick={() => selectPart(p.id)}>
      <button onClick={e => { e.stopPropagation(); toggleVisible(p.id) }}>{p.visible ? '👁' : '🙈'}</button><span>{p.name}</span><small>z:{p.zIndex}</small><button onClick={e=>{e.stopPropagation();movePart(p.id,1)}}>↑</button><button onClick={e=>{e.stopPropagation();movePart(p.id,-1)}}>↓</button>
    </div>)}</div></section>
}
