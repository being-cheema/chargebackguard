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
      setBatchMessage('Please sign in as a reviewer to execute decision gate on batch records.');
      return;
    }
    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const res = await api.batchGateDisputes(0.75, token);
      setBatchMessage(
        `Gate executed: ${res.autoApprovedCount} auto-approved (ready_to_submit), ${res.reviewCount} routed to human review.`
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
    if (diff <= 0) return { text: 'Expired', color: 'bg-red-50 text-red-600' };
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days < 2) return { text: `${hours}h left`, color: 'bg-red-50 text-red-600' };
    if (days < 5) return { text: `${days}d ${hours}h`, color: 'bg-amber-50 text-amber-700' };
    return { text: `${days}d left`, color: 'bg-surface text-ink-secondary' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready_to_submit':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Ready to Submit
          </span>
        );
      case 'needs_human_review':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-amber-50 text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Human Review
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-surface text-ink-secondary">
            Open
          </span>
        );
      case 'won':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-emerald-50 text-emerald-700">
            Won
          </span>
        );
      case 'lost':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-red-50 text-red-600">
            Lost
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-surface text-ink-secondary">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-hairline p-5 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-tertiary">Total Disputes</span>
            <FileText className="w-4 h-4 text-ink-tertiary" />
          </div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-ink mt-2">
            {Object.values(statusCounts).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-[12px] text-ink-tertiary mt-1">Full Ingested Pipeline</div>
        </div>

        <div className="bg-white border border-hairline p-5 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-tertiary">Auto-Approved (Ready)</span>
            <CheckCircle2 className="w-4 h-4 text-ink-tertiary" />
          </div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-ink mt-2">
            {statusCounts['ready_to_submit'] || 0}
          </div>
          <div className="text-[12px] text-ink-tertiary mt-1">Score &ge; 0.75 (Zero Touch)</div>
        </div>

        <div className="bg-white border border-hairline p-5 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-tertiary">Needs Human Review</span>
            <AlertTriangle className="w-4 h-4 text-ink-tertiary" />
          </div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-ink mt-2">
            {statusCounts['needs_human_review'] || 0}
          </div>
          <div className="text-[12px] text-ink-tertiary mt-1">Score &lt; 0.75 (Risk Gated)</div>
        </div>

        <div className="bg-white border border-hairline p-5 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-tertiary">Open for Processing</span>
            <Zap className="w-4 h-4 text-ink-tertiary" />
          </div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-ink mt-2">
            {statusCounts['open'] || 0}
          </div>
          <div className="text-[12px] text-ink-tertiary mt-1">Pending Gate Execution</div>
        </div>
      </div>

      {/* Batch Action Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-hairline shadow-card">
        <div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-ink-secondary" />
            <h4 className="text-[14px] font-semibold text-ink">Automated Decision Pipeline</h4>
          </div>
          <p className="text-[13px] text-ink-secondary mt-0.5">
            Run deterministic scoring, LLM letter drafting, and 0.75 safety gate across all pending open disputes.
          </p>
          {batchMessage && <div className="text-[13px] text-ink-secondary mt-1 font-medium">{batchMessage}</div>}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBatchGate}
            disabled={batchLoading}
            className="flex items-center space-x-2 bg-ink hover:bg-black text-white rounded-full px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${batchLoading ? 'animate-spin' : ''}`} />
            <span>{batchLoading ? 'Executing Gate...' : 'Run Auto-Decision Gate'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-hairline rounded-2xl p-5 space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1 bg-surface rounded-full p-1">
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
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-white text-ink shadow-card'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              {tab.label}
              {tab.id !== 'all' && statusCounts[tab.id] !== undefined && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-surface text-ink-tertiary">
                  {statusCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search, Reason Code, and Sort Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Dispute ID (disp_...) or Payment ID (pay_...)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="w-full pl-9 pr-4 py-2 bg-surface border border-hairline rounded-lg text-[13px] text-ink placeholder-ink-tertiary focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-[13px] text-ink focus:outline-none focus:border-ink"
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
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-[13px] text-ink focus:outline-none focus:border-ink"
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
      <div className="bg-white border border-hairline rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-ink-tertiary text-[12px] border-b border-hairline">
                <th className="font-medium px-6 py-3 text-left">Dispute & Payment ID</th>
                <th className="font-medium px-6 py-3 text-left">Reason Code</th>
                <th className="font-medium px-6 py-3 text-left">Amount</th>
                <th className="font-medium px-6 py-3 text-left">Respond By</th>
                <th className="font-medium px-6 py-3 text-left">Win Score</th>
                <th className="font-medium px-6 py-3 text-left">Decision Status</th>
                <th className="font-medium px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[14px]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-tertiary">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-ink-tertiary mb-2" />
                    Loading disputes...
                  </td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-tertiary">
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
                      className="border-b border-hairline last:border-0 hover:bg-surface/60 cursor-pointer transition-colors"
                    >
                      {/* IDs */}
                      <td className="px-6 py-3">
                        <div className="font-mono text-[12px] text-ink">{dispute.id}</div>
                        <div className="font-mono text-[11px] text-ink-tertiary">{dispute.payment_id}</div>
                      </td>

                      {/* Reason Code */}
                      <td className="px-6 py-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[12px] font-medium text-ink-secondary bg-surface px-2 py-0.5 rounded">
                            {dispute.reason_code}
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-tertiary capitalize mt-0.5">
                          {dispute.phase}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-3">
                        <div className="font-medium text-ink">{formatAmount(dispute.amount)}</div>
                        <div className="text-[11px] text-ink-tertiary">{dispute.days_since_transaction}d ago</div>
                      </td>

                      {/* Respond By Countdown */}
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${countdown.color}`}>
                          <Clock className="w-3 h-3 mr-1" />
                          {countdown.text}
                        </span>
                      </td>

                      {/* Win Score */}
                      <td className="px-6 py-3">
                        {score !== null ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-12 bg-surface rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 0.75 ? 'bg-emerald-500' : score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.round(score * 100))}%` }}
                              />
                            </div>
                            <span className="font-medium text-ink font-mono text-[12px]">
                              {(score * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-tertiary text-[11px] italic">Not scored</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3">{getStatusBadge(dispute.status)}</td>

                      {/* Action */}
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDispute(dispute.id);
                          }}
                          className="inline-flex items-center space-x-1 bg-white border border-hairline hover:bg-surface text-ink rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
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
        <div className="flex items-center justify-between p-5 border-t border-hairline">
          <div className="text-[13px] text-ink-secondary">
            Showing <span className="font-medium text-ink">{disputes.length}</span> of{' '}
            <span className="font-medium text-ink">{total}</span> disputes
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="bg-white border border-hairline hover:bg-surface text-ink rounded-full px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-[13px] text-ink-secondary">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="bg-white border border-hairline hover:bg-surface text-ink rounded-full px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
