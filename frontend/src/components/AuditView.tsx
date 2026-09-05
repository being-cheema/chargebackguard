import React, { useState, useEffect } from 'react';
import { ScrollText, RefreshCw, UserCheck, FileText, AlertTriangle } from 'lucide-react';
import type { AuditLogRecord } from '../types';
import { api } from '../services/api';

export const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemAuditLogs(100);
      setLogs(data.logs);
    } catch (err) {
      console.error('Failed to load system audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterAction === 'all') return true;
    return log.action === filterAction;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DECISION_GATED':
        return (
          <span className="inline-flex items-center bg-surface text-ink-secondary rounded-full px-2.5 py-1 text-[12px] font-medium">
            <FileText className="w-3 h-3 mr-1" />
            DECISION_GATED
          </span>
        );
      case 'HUMAN_APPROVED':
        return (
          <span className="inline-flex items-center bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 text-[12px] font-medium">
            <UserCheck className="w-3 h-3 mr-1" />
            HUMAN_APPROVED
          </span>
        );
      case 'HUMAN_OVERRIDDEN':
        return (
          <span className="inline-flex items-center bg-red-50 text-red-600 rounded-full px-2.5 py-1 text-[12px] font-medium">
            <AlertTriangle className="w-3 h-3 mr-1" />
            HUMAN_OVERRIDDEN
          </span>
        );
      case 'SCORED':
        return (
          <span className="inline-flex items-center bg-surface text-ink-secondary rounded-full px-2.5 py-1 text-[12px] font-medium">
            SCORED
          </span>
        );
      case 'DRAFTED':
        return (
          <span className="inline-flex items-center bg-surface text-ink-secondary rounded-full px-2.5 py-1 text-[12px] font-medium">
            DRAFTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center bg-surface text-ink-secondary rounded-full px-2.5 py-1 text-[12px] font-medium">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white border border-hairline shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="text-ink-secondary">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink tracking-tight">
                System-Wide Immutable Audit Trail
              </h2>
              <p className="text-[13px] text-ink-secondary">
                Append-only log of every score, draft, decision gate, and human reviewer action.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 bg-surface border border-hairline rounded-lg text-[13px] text-ink focus:outline-none focus:border-ink"
          >
            <option value="all">All Actions ({logs.length})</option>
            <option value="DECISION_GATED">DECISION_GATED</option>
            <option value="HUMAN_APPROVED">HUMAN_APPROVED</option>
            <option value="HUMAN_OVERRIDDEN">HUMAN_OVERRIDDEN</option>
            <option value="SCORED">SCORED</option>
            <option value="DRAFTED">DRAFTED</option>
          </select>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="bg-white border border-hairline hover:bg-surface text-ink rounded-full px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-ink-tertiary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Stream Table */}
      <div className="bg-white border border-hairline rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px] border-collapse">
            <thead>
              <tr className="text-ink-tertiary text-[12px] border-b border-hairline">
                <th className="font-medium px-6 py-3 text-left">Timestamp</th>
                <th className="font-medium px-6 py-3 text-left">Action</th>
                <th className="font-medium px-6 py-3 text-left">Dispute ID</th>
                <th className="font-medium px-6 py-3 text-left">Score</th>
                <th className="font-medium px-6 py-3 text-left">Decision & Reviewer Notes</th>
                <th className="font-medium px-6 py-3 text-right">Audit ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-tertiary">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-ink-tertiary mb-2" />
                    Loading audit stream...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-tertiary">
                    No audit records matching the action filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateStr = new Date(log.created_at * 1000).toLocaleString('en-IN');
                  return (
                    <tr key={log.id} className="border-b border-hairline last:border-0 hover:bg-surface/60 transition-colors">
                      <td className="px-6 py-3 font-mono text-[12px] text-ink-secondary whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-6 py-3">{getActionBadge(log.action)}</td>
                      <td className="px-6 py-3 font-mono text-[12px] text-ink-secondary">
                        {log.dispute_id}
                      </td>
                      <td className="px-6 py-3 font-mono text-[14px]">
                        {log.score !== null ? (
                          <span
                            className={`font-semibold ${
                              log.score >= 0.75 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {(log.score * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-ink-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 max-w-md">
                        <div className="text-ink font-medium truncate">{log.decision}</div>
                        {log.reviewer_notes && (
                          <div className="text-[12px] text-ink-tertiary truncate mt-0.5 italic">
                            {log.reviewer_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 font-mono text-[12px] text-ink-tertiary text-right">
                        {log.id}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
