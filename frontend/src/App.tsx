import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { DisputeTable } from './components/DisputeTable';
import { DisputeDetailModal } from './components/DisputeDetailModal';
import { MetricsView } from './components/MetricsView';
import { SimulatorView } from './components/SimulatorView';
import { AuditView } from './components/AuditView';
import { LoginModal } from './components/LoginModal';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'metrics' | 'simulator' | 'audit'>('queue');
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshList = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
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
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-400">ChargebackGuard</span> — AI-Assisted Chargeback Evidence Responder
          </div>
          <div className="flex items-center space-x-4">
            <span>Razorpay AI Buildathon</span>
            <span>•</span>
            <span>Track 02: AI Risk Manager</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">Defense-Only Architecture</span>
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
