import { useEditorStore } from '../editor/store'
export function ParametersPanel() {
  const s = useEditorStore()
  return <section className="panel"><h2>Parameters</h2>{s.parameters.map(p => <label className="field" key={p.id}>{p.name} <output>{(s.parameterValues[p.id] ?? p.default).toFixed(2)}</output><input type="range" min={p.min} max={p.max} step="0.01" value={s.parameterValues[p.id] ?? p.default} onChange={e => s.setParameter(p.id, Number(e.target.value))} /></label>)}
    <div className="row"><button disabled={!s.selectedPartId} onClick={() => s.saveKeyform(0)}>Save value=0</button><button disabled={!s.selectedPartId} onClick={() => s.saveKeyform(1)}>Save value=1</button>{s.savedKeyform && <output className="status">Saved value={s.savedKeyform.value}</output>}</div></section>
}
