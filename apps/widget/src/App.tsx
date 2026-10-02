import { useState } from 'react'

export default function App({ workspaceId, themeColor }: { workspaceId: string | null, themeColor: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')

  if (!workspaceId) {
    console.error("TickerPro Widget: workspaceId is missing")
    return null
  }

  const toggleOpen = () => setIsOpen(!isOpen)

  const handleSend = () => {
    if (!message.trim()) return
    // Here we would typically hit an API endpoint to register the message/lead
    // e.g. POST /api/v1/public/widget/message
    alert(`Message sent to workspace ${workspaceId}: ${message}`)
    setMessage('')
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '80px',
          right: '0',
          width: '320px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #eaeaea',
          animation: 'tp-slide-up 0.3s ease-out'
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: themeColor,
            padding: '16px',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>Chat with us</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>We typically reply in a few minutes</div>
            </div>
            <button 
              onClick={toggleOpen}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Messages Area (Mocked for now) */}
          <div style={{ height: '240px', padding: '16px', overflowY: 'auto', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
              <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '12px 12px 12px 2px', border: '1px solid #eaeaea', fontSize: '14px', color: '#333' }}>
                Hi there! 👋 How can we help you today?
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div style={{ padding: '12px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Type your message..." 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #eaeaea',
                borderRadius: '20px',
                outline: 'none',
                fontSize: '14px'
              }}
            />
            <button 
              onClick={handleSend}
              style={{
                backgroundColor: themeColor,
                color: '#fff',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button 
        onClick={toggleOpen}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '30px',
          backgroundColor: themeColor,
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
          transform: isOpen ? 'scale(0.9)' : 'scale(1)'
        }}
      >
        {isOpen ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
        )}
      </button>

      {/* Simple global styles animation */}
      <style>{`
        @keyframes tp-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
