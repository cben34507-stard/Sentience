import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

/**
 * Keeps one broken page from blanking the whole app: the nav stays usable and
 * the error is shown instead of an empty screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Sentience page error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto mt-10 max-w-lg p-6">
        <div className="flex items-center gap-2 font-semibold">
          <TriangleAlert className="h-5 w-5 text-warn" /> This page hit an error
        </div>
        <p className="mt-2 text-sm text-ink-2">The rest of Sentience still works; pick another tab, or reload to try this one again.</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-paper-2 p-3 text-xs text-ink-3">{this.state.error.message}</pre>
        <button className="btn-primary mt-4" onClick={() => location.reload()}>
          <RotateCw className="h-4 w-4" /> Reload
        </button>
      </div>
    );
  }
}
