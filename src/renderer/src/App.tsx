import './App.css'
import { AppShell } from './app/AppShell'
import { WorkspaceProvider } from './app/workspaceState'

function App() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  )
}

export default App
