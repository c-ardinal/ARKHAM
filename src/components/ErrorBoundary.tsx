import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
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
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleClearCache = () => {
    if (window.confirm('本当にすべてのデータを削除して初期化しますか？\nAre you sure you want to clear all data?')) {
        try {
            localStorage.clear();
            window.location.reload();
        } catch (e) {
            alert('Failed to clear local storage: ' + e);
        }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-slate-900 text-white p-4 overflow-auto flex flex-col items-center justify-center text-left font-sans">
          <div className="max-w-lg w-full bg-slate-800 p-6 rounded-lg shadow-2xl border border-red-500/50">
            <h1 className="text-xl font-bold text-red-400 mb-2">Application Error</h1>
            <p className="text-sm text-slate-300 mb-6">
              予期せぬエラーが発生しました。<br/>
              An unexpected error occurred.
            </p>
            
            <div className="mb-6 bg-slate-950 p-4 rounded-md border border-slate-700 overflow-x-auto">
              <p className="text-red-400 font-mono text-xs mb-2 break-all font-bold">
                {this.state.error && this.state.error.toString()}
              </p>
              <details>
                <summary className="cursor-pointer text-slate-500 text-xs hover:text-slate-300 transition-colors select-none">Show Stack Trace</summary>
                <pre className="mt-2 text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {this.state.errorInfo?.componentStack || 'No stack trace available'}
                </pre>
              </details>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors shadow-sm active:scale-95"
              >
                再読み込み<br/><span className="text-xs opacity-75">Reload</span>
              </button>
              <button 
                onClick={this.handleClearCache}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition-colors shadow-sm active:scale-95"
              >
                全データ削除して復旧<br/><span className="text-xs opacity-75">Reset & Clear Data</span>
              </button>
            </div>
            
            <p className="mt-6 text-[10px] text-slate-500 text-center">
              Please take a screenshot of this screen and report it if the issue persists.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
