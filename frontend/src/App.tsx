import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import type { NavTab } from './components/Navbar';
import { DisputeTable } from './components/DisputeTable';
import { DisputeDetailModal } from './components/DisputeDetailModal';
import { MetricsView } from './components/MetricsView';
import { SimulatorView } from './components/SimulatorView';
import { AuditView } from './components/AuditView';
import { IntegrationView } from './components/IntegrationView';
import { LoginModal } from './components/LoginModal';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('queue');
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshList = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-surface text-ink flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'queue' && (
          <DisputeTable
            key={refreshKey}
            onSelectDispute={(id) => setSelectedDisputeId(id)}
          />
        )}

        {activeTab === 'metrics' && <MetricsView />}

        {activeTab === 'simulator' && <SimulatorView />}

        {activeTab === 'audit' && <AuditView />}

        {activeTab === 'integration' && (
          <IntegrationView onOpenLogin={() => setIsLoginModalOpen(true)} />
        )}
      </main>

      {/* Dispute Detail Modal */}
      {selectedDisputeId && (
        <DisputeDetailModal
          disputeId={selectedDisputeId}
          onClose={() => setSelectedDisputeId(null)}
          onRefreshList={handleRefreshList}
          onOpenLogin={() => setIsLoginModalOpen(true)}
        />
      )}

      {/* Reviewer Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-hairline py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-ink-tertiary">
          <div>
            <span className="font-medium text-ink-secondary">ChargebackGuard</span> — AI-Assisted Chargeback Evidence Responder
          </div>
          <div className="flex items-center space-x-4">
            <span>Razorpay AI Buildathon</span>
            <span>&middot;</span>
            <span>Track 02: AI Risk Manager</span>
            <span>&middot;</span>
            <span className="text-ink-secondary font-medium">Defense-Only Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
