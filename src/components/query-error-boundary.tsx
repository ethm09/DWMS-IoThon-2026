import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  resetKey: string;
  fallback: (retry: () => void) => ReactNode;
};

/** Protected-query failures must not leave a blank application or stale controls. */
export class QueryErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}
