import { useEditorStore } from '../editor/store'
import { exportSpriteSheet } from '../render/exportSpriteSheet'
export function ExportPanel() { const s = useEditorStore(); return <section className="panel export"><button disabled={!s.parts.length} onClick={() => exportSpriteSheet(s)}>Export PNG SpriteSheet + JSON</button></section> }
