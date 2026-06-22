import type { Project } from '../editor/types'
export function saveProject(project: Project) { return JSON.stringify(project, null, 2) }
