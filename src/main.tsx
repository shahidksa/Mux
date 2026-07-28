import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

// Error boundary to display runtime errors instead of blank screen
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {error: null};
  }
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: 20, fontFamily: 'monospace', background: '#1a1a1a', color: '#ff6b6b', minHeight: '100vh'}}>
          <h2>Runtime Error:</h2>
          <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{this.state.error.message}</pre>
          <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#888'}}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
