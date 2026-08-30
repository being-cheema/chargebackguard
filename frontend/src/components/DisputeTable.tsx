import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type { DisputeRecord } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DisputeTableProps {
  onSelectDispute: (disputeId: string) => void;
}

export const DisputeTable: React.FC<DisputeTableProps> = ({ onSelectDispute }) => {
  const { token, isAuthenticated } = useAuth();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  // Filters & Sorting
  const [statusFilter, setStatusFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('respond_by_asc');
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const data = await api.getDisputes({
        status: statusFilter,
        reason_code: reasonFilter,
        search: searchQuery,
        sort: sortBy,
        limit,
        offset: page * limit,
      });
      setDisputes(data.disputes);
      setTotal(data.total);
      setStatusCounts(data.statusCounts || {});
    } catch (err) {
      console.error('Failed to load disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter, reasonFilter, searchQuery, sortBy, page]);

  const handleBatchGate = async () => {
    if (!isAuthenticated || !token) {
      setBatchMessage('🔒 Please sign in as a reviewer to execute decision gate on batch records.');
      return;
    }
    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const res = await api.batchGateDisputes(0.75, token);
      setBatchMessage(
        `⚡ Gate Executed: ${res.autoApprovedCount} auto-approved (ready_to_submit), ${res.reviewCount} routed to human review.`
      );
      await fetchDisputes();
    } catch (err: any) {
      setBatchMessage(`Error running batch gate: ${err.message}`);
    } finally {
      setBatchLoading(false);
    }
  };

  const formatAmount = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100);
  };

  const formatCountdown = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;
    if (diff <= 0) return { text: 'Expired', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days < 2) return { text: `${hours}h left`, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse' };
    if (days < 5) return { text: `${days}d ${hours}h`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    return { text: `${days}d left`, color: 'text-slate-300 bg-slate-800/60 border-slate-700' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready_to_submit':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Ready to Submit
          </span>
        );
      case 'needs_human_review':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Human Review
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            Open
          </span>
        );
      case 'won':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30">
            Won
          </span>
        );
      case 'lost':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Lost
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Disputes</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {Object.values(statusCounts).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Full Ingested Pipeline</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">Auto-Approved (Ready)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {statusCounts['ready_to_submit'] || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Score ≥ 0.75 (Zero Touch)</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400">Needs Human Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {statusCounts['needs_human_review'] || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Score &lt; 0.75 (Risk Gated)</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400">Open for Processing</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-2">
            {statusCounts['open'] || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Pending Gate Execution</div>
        </div>
      </div>

      {/* Batch Action Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-500/20 shadow-md">
        <div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-bold text-white">Automated Decision Pipeline</h4>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Run deterministic scoring, LLM letter drafting, and 0.75 safety gate across all pending open disputes.
          </p>
          {batchMessage && <div className="text-xs text-emerald-400 mt-1 font-medium">{batchMessage}</div>}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBatchGate}
            disabled={batchLoading}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${batchLoading ? 'animate-spin' : ''}`} />
            <span>{batchLoading ? 'Executing Gate...' : 'Run Auto-Decision Gate'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'all', label: 'All Cases' },
            { id: 'needs_human_review', label: 'Human Review Queue' },
            { id: 'ready_to_submit', label: 'Ready to Submit' },
            { id: 'open', label: 'Open' },
            { id: 'won', label: 'Won' },
            { id: 'lost', label: 'Lost' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
              {tab.id !== 'all' && statusCounts[tab.id] !== undefined && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
                  {statusCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search, Reason Code, and Sort Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by Dispute ID (disp_...) or Payment ID (pay_...)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Reason Codes</option>
              <option value="RZP01">RZP01 — Service Not Provided</option>
              <option value="RZP04">RZP04 — Refund Not Processed</option>
              <option value="RZP05">RZP05 — Debited No Confirmation</option>
              <option value="RZP06">RZP06 — Business Unresponsive</option>
              <option value="RZP00">RZP00 — General / Unspecified</option>
              <option value="1061">1061 / C02 — Credit Not Processed</option>
              <option value="1062">1062 / 13.3 — Not As Described</option>
              <option value="1064">1064 / 13.1 — Goods Not Received</option>
              <option value="13.2">13.2 / 4841 / C28 — Cancelled Recurring</option>
            </select>
          </div>

          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="respond_by_asc">Deadline: Soonest First</option>
              <option value="score_desc">Win Score: Highest First</option>
              <option value="score_asc">Win Score: Lowest First</option>
              <option value="amount_desc">Amount: Highest First</option>
              <option value="amount_asc">Amount: Lowest First</option>
              <option value="created_at_desc">Date: Newest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Disputes Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Dispute & Payment ID</th>
                <th className="py-3.5 px-4">Reason Code</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Respond By</th>
                <th className="py-3.5 px-4">Win Score</th>
                <th className="py-3.5 px-4">Decision Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Loading disputes...
                  </td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No disputes match the selected filters.
                  </td>
                </tr>
              ) : (
                disputes.map((dispute) => {
                  const countdown = formatCountdown(dispute.respond_by);
                  const score = dispute.win_score ?? null;

                  return (
                    <tr
                      key={dispute.id}
                      onClick={() => onSelectDispute(dispute.id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      {/* IDs */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-semibold text-slate-200">{dispute.id}</div>
                        <div className="font-mono text-[10px] text-slate-500">{dispute.payment_id}</div>
                      </td>

                      {/* Reason Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {dispute.reason_code}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 capitalize mt-0.5">
                          {dispute.phase}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-200">{formatAmount(dispute.amount)}</div>
                        <div className="text-[10px] text-slate-500">{dispute.days_since_transaction}d ago</div>
                      </td>

                      {/* Respond By Countdown */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${countdown.color}`}>
                          <Clock className="w-3 h-3 mr-1" />
                          {countdown.text}
                        </span>
                      </td>

                      {/* Win Score */}
                      <td className="py-3.5 px-4">
                        {score !== null ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-12 bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 0.75 ? 'bg-emerald-400' : score >= 0.5 ? 'bg-amber-400' : 'bg-rose-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.round(score * 100))}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-200 font-mono">
                              {(score * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Not scored</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">{getStatusBadge(dispute.status)}</td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDispute(dispute.id);
                          }}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-700 hover:border-blue-500 transition-all shadow-sm"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-200">{disputes.length}</span> of{' '}
            <span className="font-semibold text-slate-200">{total}</span> disputes
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
