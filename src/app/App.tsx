import { PixiViewport } from '../render/PixiViewport'
import { ExportPanel } from '../ui/ExportPanel'
import { ParametersPanel } from '../ui/ParametersPanel'
import { PartsPanel } from '../ui/PartsPanel'
import { TimelinePanel } from '../ui/TimelinePanel'

export function App() {
  return <main className="app">
    <header><h1>Lite2D Mesh Sprite Sheet MVP</h1><ExportPanel /></header>
    <aside className="left"><PartsPanel /><ParametersPanel /></aside>
    <section className="canvas"><PixiViewport /></section>
    <footer><TimelinePanel /></footer>
  </main>
}
