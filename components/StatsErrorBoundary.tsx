import React from 'react';

type StatsErrorBoundaryProps = {
  children: React.ReactNode;
  onReset?: () => void;
};

type StatsErrorBoundaryState = {
  error: Error | null;
};

class StatsErrorBoundary extends React.Component<StatsErrorBoundaryProps, StatsErrorBoundaryState> {
  state: StatsErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StatsErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface stats-only failures without crashing the whole app.
    console.error('StatsErrorBoundary', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex-1 flex flex-col p-6 pb-28 ios-bg ios-text">
        <header className="mb-6 pt-2">
          <h1 className="text-2xl font-black">统计</h1>
          <p className="mt-1 text-xs opacity-70">页面加载失败，请重试或重置统计数据。</p>
        </header>
        <div className="ios-card p-5 rounded-2xl">
          <div className="text-sm font-semibold">错误详情</div>
          <div className="mt-2 text-xs opacity-70 break-words">{error.message || '未知错误'}</div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="ios-btn h-9 px-4 rounded-full text-sm font-semibold"
              onClick={() => this.setState({ error: null })}
            >
              重试
            </button>
            {this.props.onReset && (
              <button
                type="button"
                className="ios-btn h-9 px-4 rounded-full text-sm font-semibold"
                onClick={this.props.onReset}
              >
                重置统计数据
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default StatsErrorBoundary;
