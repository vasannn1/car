export default function Loading() {
  return (
    <main className="app-shell loading-shell" aria-busy="true" aria-label="Loading operations">
      <aside className="sidebar loading-sidebar">
        <div className="loading-brand" />
      </aside>
      <section className="main-panel">
        <div className="topbar">
          <span className="loading-line loading-short" />
        </div>
        <div className="page-content loading-content">
          <span className="loading-line loading-title" />
          <span className="loading-line loading-subtitle" />
          <div className="loading-metrics">
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="loading-line loading-section" />
          <div className="loading-table">
            <i />
            <i />
            <i />
          </div>
          <span className="loading-line loading-section" />
          <div className="loading-table">
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
    </main>
  );
}
