import React, { useState, useEffect } from 'react';
import { ScrollText, RefreshCw, UserCheck, Sparkles, AlertTriangle } from 'lucide-react';
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
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            DECISION_GATED
          </span>
        );
      case 'HUMAN_APPROVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <UserCheck className="w-3 h-3 mr-1" />
            HUMAN_APPROVED
          </span>
        );
      case 'HUMAN_OVERRIDDEN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            HUMAN_OVERRIDDEN
          </span>
        );
      case 'SCORED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            SCORED
          </span>
        );
      case 'DRAFTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            DRAFTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                System-Wide Immutable Audit Trail
              </h2>
              <p className="text-xs text-slate-400">
                Append-only log of every score, draft, decision gate, and human reviewer action.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Stream Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase text-slate-400">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Dispute ID</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Decision & Reviewer Notes</th>
                <th className="py-3.5 px-4 text-right">Audit ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Loading audit stream...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No audit records matching the action filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateStr = new Date(log.created_at * 1000).toLocaleString('en-IN');
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4">{getActionBadge(log.action)}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                        {log.dispute_id}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {log.score !== null ? (
                          <span
                            className={`font-bold ${
                              log.score >= 0.75 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {(log.score * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="text-slate-200 font-medium truncate">{log.decision}</div>
                        {log.reviewer_notes && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5 italic">
                            {log.reviewer_notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-600 text-right">
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
