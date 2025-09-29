import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary" style={{
          padding: '20px',
          border: '1px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#fff5f5',
          margin: '16px 0'
        }}>
          <h3 style={{ color: '#d63031', margin: '0 0 12px 0' }}>
            Something went wrong
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#666' }}>
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          
          {import.meta.env.DEV && this.state.error && (
            <details style={{ margin: '16px 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
                Error Details (Development)
              </summary>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '12px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                <div><strong>Error:</strong> {this.state.error.message}</div>
                <div><strong>Stack:</strong></div>
                <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>
                  {this.state.error.stack}
                </pre>
                {this.state.errorInfo && (
                  <>
                    <div><strong>Component Stack:</strong></div>
                    <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}
          
          <button 
            className="btn btn-primary"
            onClick={this.handleRetry}
            style={{ marginRight: '8px' }}
          >
            Try Again
          </button>
          <button 
            className="btn btn-outline"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}