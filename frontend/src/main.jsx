import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './context/I18nContext';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Clinical Telemetry caught runtime error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#F8FAFC', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ maxWidth: '460px', width: '100%', background: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '24px', padding: '32px', textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🏥</div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#fff' }}>Smart Healthcare Telemetry Portal</h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6', margin: '0 0 16px 0' }}>
              The portal encountered a display synchronization state. Your medical records, authentication, and clinical data remain secure.
            </p>
            {this.state.error?.message && (
              <div style={{ fontSize: '11px', color: '#FCA5A5', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '8px 12px', borderRadius: '10px', marginBottom: '20px', fontFamily: 'monospace', wordBreak: 'break-word', textAlign: 'left' }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { window.location.href = '/dashboard'; }}
                style={{ padding: '10px 20px', borderRadius: '12px', background: '#0284C7', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                Reload Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.clear(); } catch {}
                  window.location.href = '/login';
                }}
                style={{ padding: '10px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                Sign In Again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
