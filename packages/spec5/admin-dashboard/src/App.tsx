import { useMemo, useState } from 'react';
import { ExclusionsPage } from './pages/Exclusions';
import { FraudMonitorPage } from './pages/FraudMonitor';
import { HeatmapPage } from './pages/Heatmap';
import { ManualReviewPage } from './pages/ManualReview';
import { OverviewPage } from './pages/Overview';

type TabKey = 'overview' | 'heatmap' | 'fraud' | 'manual-review' | 'exclusions';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'heatmap', label: 'H3 Risk Heatmap' },
  { key: 'fraud', label: 'Fraud Monitor' },
  { key: 'manual-review', label: 'Manual Review + LLM' },
  { key: 'exclusions', label: 'Exclusions + Health' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const page = useMemo(() => {
    if (activeTab === 'overview') return <OverviewPage />;
    if (activeTab === 'heatmap') return <HeatmapPage />;
    if (activeTab === 'fraud') return <FraudMonitorPage />;
    if (activeTab === 'manual-review') return <ManualReviewPage />;
    return <ExclusionsPage />;
  }, [activeTab]);

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />
      <header className="topbar">
        <div>
          <p className="eyebrow">KawaachAI</p>
          <h1>Admin Command Center</h1>
          
        </div>
        <nav className="tab-bar" aria-label="Main sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="page-container">{page}</main>
    </div>
  );
}

export default App;
