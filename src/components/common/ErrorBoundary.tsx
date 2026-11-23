import React, { type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('TaskFlow ErrorBoundary caught:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      let displayError = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed?.error) {
          displayError = `${parsed.error} (${parsed.operationType} on ${parsed.path || 'database'})`;
        }
      } catch {
        // plain string message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC] dark:bg-[#0D0E14] p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 text-[#EF4444] flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-[#20212B] dark:text-[#F4F5FA] mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mb-5 break-words">
              {displayError}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.href = '/dashboard';
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload TaskFlow
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
