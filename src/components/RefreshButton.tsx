interface Props {
  refreshing: boolean;
  onClick: () => void;
}

export function RefreshButton({ refreshing, onClick }: Props) {
  return (
    <button
      className="refresh-btn"
      onClick={onClick}
      disabled={refreshing}
      title="Re-fetch live from raw.githubusercontent.com (without line numbers)"
    >
      <span className={refreshing ? 'spin' : ''} aria-hidden>
        {refreshing ? '⟳' : '↻'}
      </span>
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
