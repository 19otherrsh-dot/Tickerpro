import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const WIDGET_ID = 'tickerpro-widget-root'

// Prevent multiple initializations
if (!document.getElementById(WIDGET_ID)) {
  const container = document.createElement('div')
  container.id = WIDGET_ID
  document.body.appendChild(container)
  
  // Extract configuration from the script tag if provided
  // e.g. <script src="widget.js" data-workspace-id="..." data-color="#10b981"></script>
  const scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"]');
  const workspaceId = scriptTag?.getAttribute('data-workspace-id') || null;
  const color = scriptTag?.getAttribute('data-color') || "#10B981";

  createRoot(container).render(
    <StrictMode>
      <App workspaceId={workspaceId} themeColor={color} />
    </StrictMode>,
  )
}
