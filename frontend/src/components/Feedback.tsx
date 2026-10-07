export function Feedback({ loading, error, retry }: { loading: boolean; error: string; retry?: () => void }) {
  if (loading) return <p className="panel" role="status">Loading your workspace…</p>;
  if (error) return <div className="notice error" role="alert"><p>{error}</p>{retry && <button className="button secondary mt-3" onClick={retry}>Try again</button>}</div>;
  return null;
}
