import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  XCircle,
  ExternalLink,
  UserCheck,
  History,
  Lock,
  RefreshCw,
  Info,
} from 'lucide-react';
import type { DisputeRecord, ScoreResult, AuditLogRecord, EvidenceKey } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DisputeDetailModalProps {
  disputeId: string;
  onClose: () => void;
  onRefreshList: () => void;
  onOpenLogin: () => void;
}

export const DisputeDetailModal: React.FC<DisputeDetailModalProps> = ({
  disputeId,
  onClose,
  onRefreshList,
  onOpenLogin,
}) => {
  const { token, reviewer, isAuthenticated } = useAuth();

  const [dispute, setDispute] = useState<DisputeRecord | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'evidence' | 'letter' | 'review' | 'audit'>('evidence');

  // Letter state
  const [explanationLetter, setExplanationLetter] = useState('');
  const [draftingLoading, setDraftingLoading] = useState(false);

  // Reviewer Action state
  const [reviewAction, setReviewAction] = useState<'APPROVE_SUBMISSION' | 'OVERRIDE_STATUS'>('APPROVE_SUBMISSION');
  const [overrideStatus, setOverrideStatus] = useState<string>('ready_to_submit');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDisputeData = async () => {
    setLoading(true);
    try {
      const data = await api.getDispute(disputeId);
      setDispute(data.dispute);
      setScoreResult(data.scoreResult);
      setExplanationLetter(data.dispute.evidence.explanation_letter || '');

      const logsData = await api.getDisputeAuditLogs(disputeId);
      setAuditLogs(logsData.logs);
    } catch (err) {
      console.error('Failed to load dispute detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputeData();
  }, [disputeId]);

  const handleTriggerDraft = async () => {
    setDraftingLoading(true);
    setActionError(null);
    try {
      const res = await api.draftLetter(disputeId);
      setExplanationLetter(res.draftResult.letter);
      await loadDisputeData();
    } catch (err: any) {
      setActionError(`Drafting failed: ${err.message}`);
    } finally {
      setDraftingLoading(false);
    }
  };

  const handleExecuteGate = async () => {
    setDraftingLoading(true);
    setActionError(null);
    try {
      const res = await api.gateDispute(disputeId, 0.75);
      setActionSuccess(`Gate executed! New status: ${res.gateResult.status}`);
      await loadDisputeData();
      onRefreshList();
    } catch (err: any) {
      setActionError(`Gate execution failed: ${err.message}`);
    } finally {
      setDraftingLoading(false);
    }
  };

  const handleReviewerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !token) {
      onOpenLogin();
      return;
    }

    setSubmittingReview(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const payload: any = {
        action: reviewAction,
        reviewer_notes: reviewerNotes,
      };

      if (reviewAction === 'OVERRIDE_STATUS') {
        payload.status = overrideStatus;
      }

      if (explanationLetter) {
        payload.explanation_letter = explanationLetter;
      }

      const res = await api.reviewDispute(disputeId, payload, token);
      setActionSuccess(`Review recorded! Dispute status updated to ${res.status}.`);
      setReviewerNotes('');
      await loadDisputeData();
      onRefreshList();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit review action.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading || !dispute) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col items-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
          <p className="text-sm font-semibold text-slate-300">Loading dispute intelligence...</p>
        </div>
      </div>
    );
  }

  const formatAmount = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100);
  };

  const allEvidenceKeys: Array<{ key: EvidenceKey; label: string }> = [
    { key: 'shipping_proof', label: 'Shipping / Tracking Proof' },
    { key: 'proof_of_service', label: 'Proof of Service / Delivery' },
    { key: 'billing_proof', label: 'Billing Proof / Invoice' },
    { key: 'customer_communication', label: 'Customer Communication Logs' },
    { key: 'refund_confirmation', label: 'Refund Confirmation (ARN)' },
    { key: 'access_activity_log', label: 'Access & Activity Logs' },
    { key: 'cancellation_proof', label: 'Cancellation Proof' },
    { key: 'refund_cancellation_policy', label: 'Refund / Cancellation Policy' },
    { key: 'term_and_conditions', label: 'Terms & Conditions' },
    { key: 'others', label: 'Other Supporting Files' },
  ];

  const score = scoreResult?.score ?? dispute.win_score ?? 0;
  const isAutoSubmit = score >= 0.75;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl my-4">
        {/* Header Summary Banner */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5 flex-wrap">
                <span className="font-mono text-lg font-bold text-white tracking-tight">{dispute.id}</span>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {dispute.payment_id}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  Phase: {dispute.phase}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Reason Code: <span className="font-bold text-slate-200">{dispute.reason_code}</span> | Transaction filed{' '}
                <span className="text-slate-200">{dispute.days_since_transaction} days ago</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-xl font-extrabold text-white">{formatAmount(dispute.amount)}</div>
                <div className="text-[11px] text-slate-400">Disputed Amount</div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Status and Gating Strip */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400">Decision Status:</span>
                <span className="font-semibold text-slate-200 uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  {dispute.status}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400">Win Probability:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                  score >= 0.75 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {(score * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExecuteGate}
                disabled={draftingLoading}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run Decision Gate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'evidence'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Score & Evidence Breakdown</span>
          </button>

          <button
            onClick={() => setActiveTab('letter')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'letter'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Drafted Letter</span>
            {dispute.evidence.explanation_letter && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'review'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Reviewer Actions</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        {/* Action Notifications */}
        {actionSuccess && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {/* TAB 1: Evidence & Score Breakdown */}
          {activeTab === 'evidence' && (
            <div className="space-y-6">
              {/* Score Gauge & Recommendation Box */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400">Deterministic Win Score</span>
                  <div className="my-2 flex items-baseline space-x-2">
                    <span className="text-4xl font-extrabold font-mono text-white">
                      {(score * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      ({scoreResult?.confidenceLevel || 'MEDIUM'} Confidence)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        score >= 0.75 ? 'bg-emerald-400' : score >= 0.5 ? 'bg-amber-400' : 'bg-rose-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.round(score * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400">Safety Gate Recommendation</span>
                  <div className="my-2">
                    {isAutoSubmit ? (
                      <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        AUTO-SUBMIT APPROVED (≥ 0.75)
                      </div>
                    ) : (
                      <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 mr-1.5" />
                        ROUTE TO HUMAN REVIEW (&lt; 0.75)
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Decision threshold: <span className="font-mono text-slate-200">0.75</span> (Prevents false positives)
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400">Fraud & Context Telemetry</span>
                  <div className="space-y-1 my-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dispute History:</span>
                      <span className="text-slate-200 font-semibold">{dispute.customer_dispute_history_count} previous</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Billing IP Match:</span>
                      <span className={dispute.ip_matches_billing_country ? 'text-emerald-400' : 'text-rose-400 font-semibold'}>
                        {dispute.ip_matches_billing_country ? 'Matched' : 'Mismatch Risk'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Response Speed:</span>
                      <span className="text-slate-200">{dispute.merchant_response_time_hours} hours</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 italic">No LLM used in score calculation</div>
                </div>
              </div>

              {/* Driving Factors List */}
              {scoreResult?.factors && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Transparent Factor Attribution (Mathematical Audit)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Positive Factors */}
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                      <div className="text-xs font-bold text-emerald-400 flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Positive Driving Factors ({scoreResult.factors.positive.length})
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {scoreResult.factors.positive.map((factor, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Negative Factors */}
                    <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-2">
                      <div className="text-xs font-bold text-rose-400 flex items-center">
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Negative Driving Penalties ({scoreResult.factors.negative.length})
                      </div>
                      {scoreResult.factors.negative.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No negative penalties identified.</p>
                      ) : (
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {scoreResult.factors.negative.map((factor, idx) => (
                            <li key={idx} className="flex items-start space-x-1.5">
                              <span className="text-rose-400 font-bold">•</span>
                              <span>{factor}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Evidence Checklist Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Evidence Verification Matrix
                  </h4>
                  <span className="text-xs text-slate-500">
                    Matches Razorpay real Disputes API schema
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {allEvidenceKeys.map(({ key, label }) => {
                    const fileUrl = dispute.evidence[key];
                    const isPresent = !!fileUrl;
                    const isMissingRequired = scoreResult?.missingRequiredEvidence.includes(key);

                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                          isPresent
                            ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                            : isMissingRequired
                            ? 'bg-rose-950/10 border-rose-500/30'
                            : 'bg-slate-950/30 border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {isPresent ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className={`w-4 h-4 flex-shrink-0 ${isMissingRequired ? 'text-rose-400' : 'text-slate-600'}`} />
                          )}
                          <div className="truncate">
                            <div className="text-xs font-medium text-slate-200 truncate">{label}</div>
                            <div className="text-[10px] font-mono text-slate-500">{key}</div>
                          </div>
                        </div>

                        {isPresent ? (
                          <a
                            href={fileUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex-shrink-0 ml-2"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className={`text-[10px] font-semibold flex-shrink-0 ${isMissingRequired ? 'text-rose-400' : 'text-slate-600'}`}>
                            {isMissingRequired ? 'Required Missing' : 'Absent'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI Drafted Explanation Letter */}
          {activeTab === 'letter' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Official Contest Explanation Letter
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Strictly grounded in present evidence with zero hallucination enforcement.
                  </p>
                </div>

                <button
                  onClick={handleTriggerDraft}
                  disabled={draftingLoading}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${draftingLoading ? 'animate-spin' : ''}`} />
                  <span>{draftingLoading ? 'Synthesizing...' : 'Draft with Claude'}</span>
                </button>
              </div>

              {/* Anti-Hallucination Verified Badge */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Anti-Hallucination Guard Active</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Character Count: <span className={`font-mono font-bold ${explanationLetter.length > 1000 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {explanationLetter.length}
                    </span> / 1000 max (Razorpay API Cap)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      explanationLetter.length > 1000 ? 'bg-rose-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, (explanationLetter.length / 1000) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Editable Text Area */}
              <div>
                <textarea
                  rows={8}
                  value={explanationLetter}
                  onChange={(e) => setExplanationLetter(e.target.value)}
                  placeholder="Click 'Draft with Claude' or write a custom explanation letter referencing attached records..."
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors leading-relaxed resize-none"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <div className="flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Only files marked as present in the evidence matrix are cited.</span>
                </div>
                <button
                  onClick={async () => {
                    if (!isAuthenticated) onOpenLogin();
                    else {
                      await api.reviewDispute(
                        disputeId,
                        {
                          action: 'UPDATE_LETTER',
                          reviewer_notes: 'Updated letter draft manually.',
                          explanation_letter: explanationLetter,
                        },
                        token!
                      );
                      setActionSuccess('Letter changes saved to dispute record!');
                      await loadDisputeData();
                    }
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Save Letter Changes
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Reviewer Actions */}
          {activeTab === 'review' && (
            <div className="space-y-5">
              {!isAuthenticated ? (
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
                  <Lock className="w-8 h-8 text-blue-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Reviewer Authentication Required</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    State-changing actions (overriding statuses, approving auto-submissions) require an authenticated risk analyst session for complete audit compliance.
                  </p>
                  <button
                    onClick={onOpenLogin}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-500/20"
                  >
                    Sign In as Reviewer
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReviewerSubmit} className="space-y-4 bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                    <UserCheck className="w-4 h-4" />
                    <span>Logged in as {reviewer?.name} ({reviewer?.email})</span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">Action Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReviewAction('APPROVE_SUBMISSION')}
                        className={`p-3 rounded-lg border text-left text-xs transition-all ${
                          reviewAction === 'APPROVE_SUBMISSION'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold">Approve Auto-Submission</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Move case to ready_to_submit</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewAction('OVERRIDE_STATUS')}
                        className={`p-3 rounded-lg border text-left text-xs transition-all ${
                          reviewAction === 'OVERRIDE_STATUS'
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold">Override Status</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Manually change status</div>
                      </button>
                    </div>
                  </div>

                  {reviewAction === 'OVERRIDE_STATUS' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Status</label>
                      <select
                        value={overrideStatus}
                        onChange={(e) => setOverrideStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="ready_to_submit">ready_to_submit</option>
                        <option value="needs_human_review">needs_human_review</option>
                        <option value="under_review">under_review</option>
                        <option value="won">won</option>
                        <option value="lost">lost</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Reviewer Reason & Justification <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="Explain your operational decision for the audit log..."
                      className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingReview || !reviewerNotes.trim()}
                      className="px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                      {submittingReview ? 'Recording Action...' : 'Commit Review Decision'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: Audit Trail History */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Immutable Audit Log Trail
                </h4>
                <span className="text-xs text-slate-500 font-mono">
                  {auditLogs.length} events logged
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">
                  No audit log entries recorded for this dispute yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const dateStr = new Date(log.created_at * 1000).toLocaleString('en-IN');
                    return (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                              {log.action}
                            </span>
                            <span className="text-[11px] text-slate-400">{dateStr}</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-600">{log.id}</span>
                        </div>

                        <div className="text-slate-200 font-medium">{log.decision}</div>

                        {log.reviewer_notes && (
                          <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/80">
                            {log.reviewer_notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
