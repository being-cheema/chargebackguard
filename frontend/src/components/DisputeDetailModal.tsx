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
    if (!isAuthenticated || !token) {
      onOpenLogin();
      return;
    }
    setDraftingLoading(true);
    setActionError(null);
    try {
      const res = await api.draftLetter(disputeId, token);
      setExplanationLetter(res.draftResult.letter);
      await loadDisputeData();
    } catch (err: any) {
      setActionError(`Drafting failed: ${err.message}`);
    } finally {
      setDraftingLoading(false);
    }
  };

  const handleExecuteGate = async () => {
    if (!isAuthenticated || !token) {
      onOpenLogin();
      return;
    }
    setDraftingLoading(true);
    setActionError(null);
    try {
      const res = await api.gateDispute(disputeId, 0.75, token);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
        <div className="bg-white border border-hairline p-8 rounded-2xl flex flex-col items-center shadow-popover">
          <RefreshCw className="w-8 h-8 animate-spin text-ink-tertiary mb-3" />
          <p className="text-[14px] font-medium text-ink-secondary">Loading dispute intelligence...</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/30 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white border border-hairline rounded-2xl w-full max-w-5xl overflow-hidden shadow-popover my-4">
        {/* Header Summary Banner */}
        <div className="p-5 border-b border-hairline bg-white">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5 flex-wrap">
                <span className="font-mono text-[17px] font-semibold text-ink tracking-tight">{dispute.id}</span>
                <span className="font-mono text-[12px] font-medium px-2 py-0.5 rounded-full bg-surface text-ink-secondary">
                  {dispute.payment_id}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium uppercase tracking-wide bg-surface text-ink-tertiary">
                  Phase: {dispute.phase}
                </span>
              </div>
              <div className="text-[12px] text-ink-tertiary">
                Reason Code: <span className="font-medium text-ink-secondary">{dispute.reason_code}</span> | Transaction filed{' '}
                <span className="text-ink-secondary">{dispute.days_since_transaction} days ago</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-[20px] font-semibold text-ink">{formatAmount(dispute.amount)}</div>
                <div className="text-[11px] text-ink-tertiary">Disputed Amount</div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-ink-tertiary hover:text-ink hover:bg-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Status and Gating Strip */}
          <div className="mt-4 pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <span className="text-ink-tertiary">Decision Status:</span>
                <span className="font-medium text-ink-secondary uppercase px-2 py-0.5 rounded-full bg-surface">
                  {dispute.status}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-ink-tertiary">Win Probability:</span>
                <span className={`font-mono font-medium px-2 py-0.5 rounded-full ${
                  score >= 0.75 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {(score * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExecuteGate}
                disabled={draftingLoading}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-full text-[13px] font-medium bg-ink hover:bg-black text-white transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run Decision Gate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-hairline bg-white px-5">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center space-x-2 py-3 px-4 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === 'evidence'
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Score & Evidence Breakdown</span>
          </button>

          <button
            onClick={() => setActiveTab('letter')}
            className={`flex items-center space-x-2 py-3 px-4 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === 'letter'
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Drafted Letter</span>
            {dispute.evidence.explanation_letter && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`flex items-center space-x-2 py-3 px-4 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === 'review'
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Reviewer Actions</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center space-x-2 py-3 px-4 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        {/* Action Notifications */}
        {actionSuccess && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-[13px] flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 text-red-600 text-[13px] flex items-center space-x-2">
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
                <div className="bg-white p-4 rounded-xl border border-hairline flex flex-col justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-ink-tertiary">Deterministic Win Score</span>
                  <div className="my-2 flex items-baseline space-x-2">
                    <span className="text-4xl font-semibold font-mono text-ink">
                      {(score * 100).toFixed(0)}%
                    </span>
                    <span className="text-[12px] font-medium text-ink-tertiary">
                      ({scoreResult?.confidenceLevel || 'MEDIUM'} Confidence)
                    </span>
                  </div>
                  <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-ink rounded-full h-1.5"
                      style={{ width: `${Math.min(100, Math.round(score * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-hairline flex flex-col justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-ink-tertiary">Safety Gate Recommendation</span>
                  <div className="my-2">
                    {isAutoSubmit ? (
                      <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Auto-submit approved (≥ 0.75)
                      </div>
                    ) : (
                      <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[12px] font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                        Route to human review (&lt; 0.75)
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-tertiary">
                    Decision threshold: <span className="font-mono text-ink-secondary">0.75</span> (Prevents false positives)
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-hairline flex flex-col justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-ink-tertiary">Fraud & Context Telemetry</span>
                  <div className="space-y-1 my-2 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-ink-tertiary">Dispute History:</span>
                      <span className="text-ink-secondary font-medium">{dispute.customer_dispute_history_count} previous</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-tertiary">Billing IP Match:</span>
                      <span className={dispute.ip_matches_billing_country ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
                        {dispute.ip_matches_billing_country ? 'Matched' : 'Mismatch Risk'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-tertiary">Response Speed:</span>
                      <span className="text-ink-secondary">{dispute.merchant_response_time_hours} hours</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-ink-tertiary italic">No LLM used in score calculation</div>
                </div>
              </div>

              {/* Driving Factors List */}
              {scoreResult?.factors && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
                    Transparent Factor Attribution (Mathematical Audit)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Positive Factors */}
                    <div className="p-3.5 rounded-xl bg-emerald-50 space-y-2">
                      <div className="text-[12px] font-medium text-emerald-700 flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Positive Driving Factors ({scoreResult.factors.positive.length})
                      </div>
                      <ul className="space-y-1.5 text-[13px] text-ink-secondary">
                        {scoreResult.factors.positive.map((factor, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <span className="text-emerald-700 font-medium">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Negative Factors */}
                    <div className="p-3.5 rounded-xl bg-red-50 space-y-2">
                      <div className="text-[12px] font-medium text-red-600 flex items-center">
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Negative Driving Penalties ({scoreResult.factors.negative.length})
                      </div>
                      {scoreResult.factors.negative.length === 0 ? (
                        <p className="text-[13px] text-ink-tertiary italic">No negative penalties identified.</p>
                      ) : (
                        <ul className="space-y-1.5 text-[13px] text-ink-secondary">
                          {scoreResult.factors.negative.map((factor, idx) => (
                            <li key={idx} className="flex items-start space-x-1.5">
                              <span className="text-red-600 font-medium">•</span>
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
                  <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
                    Evidence Verification Matrix
                  </h4>
                  <span className="text-[12px] text-ink-tertiary">
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
                        className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                          isPresent
                            ? 'bg-white border-hairline hover:border-ink-tertiary'
                            : isMissingRequired
                            ? 'bg-red-50 border-red-100'
                            : 'bg-surface border-hairline opacity-70'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {isPresent ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                          ) : (
                            <XCircle className={`w-4 h-4 flex-shrink-0 ${isMissingRequired ? 'text-red-600' : 'text-ink-tertiary'}`} />
                          )}
                          <div className="truncate">
                            <div className="text-[13px] font-medium text-ink truncate">{label}</div>
                            <div className="text-[11px] font-mono text-ink-tertiary">{key}</div>
                          </div>
                        </div>

                        {isPresent ? (
                          <a
                            href={fileUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 text-[12px] text-accent hover:text-accent-hover font-medium flex-shrink-0 ml-2"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className={`text-[11px] font-medium flex-shrink-0 ${isMissingRequired ? 'text-red-600' : 'text-ink-tertiary'}`}>
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
                  <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
                    Official Contest Explanation Letter
                  </h4>
                  <p className="text-[13px] text-ink-secondary mt-0.5">
                    Strictly grounded in present evidence with zero hallucination enforcement.
                  </p>
                </div>

                <button
                  onClick={handleTriggerDraft}
                  disabled={draftingLoading}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-full text-[13px] font-medium bg-ink hover:bg-black text-white transition-colors disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${draftingLoading ? 'animate-spin' : ''}`} />
                  <span>{draftingLoading ? 'Synthesizing...' : 'Draft with Claude'}</span>
                </button>
              </div>

              {/* Anti-Hallucination Verified Badge */}
              <div className="p-3 rounded-xl bg-surface space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center space-x-2 text-ink-secondary font-medium">
                    <ShieldCheck className="w-4 h-4 text-ink-tertiary" />
                    <span>Anti-Hallucination Guard Active</span>
                  </div>
                  <span className="text-[11px] text-ink-tertiary">
                    Character Count: <span className={`font-mono font-medium ${explanationLetter.length > 1000 ? 'text-red-600' : 'text-ink-secondary'}`}>
                      {explanationLetter.length}
                    </span> / 1000 max (Razorpay API Cap)
                  </span>
                </div>
                <div className="w-full bg-white rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      explanationLetter.length > 1000 ? 'bg-red-600' : 'bg-ink'
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
                  className="w-full p-4 bg-surface border border-hairline rounded-xl text-[14px] font-sans text-ink placeholder-ink-tertiary focus:outline-none focus:border-ink transition-colors leading-relaxed resize-none"
                />
              </div>

              <div className="flex items-center justify-between text-[12px] text-ink-tertiary bg-surface p-3 rounded-xl">
                <div className="flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-ink-tertiary" />
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
                  className="text-accent hover:text-accent-hover font-medium"
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
                <div className="p-6 rounded-xl bg-surface text-center space-y-3">
                  <Lock className="w-8 h-8 text-ink-tertiary mx-auto" />
                  <h4 className="text-[15px] font-semibold text-ink">Reviewer Authentication Required</h4>
                  <p className="text-[13px] text-ink-secondary max-w-md mx-auto">
                    State-changing actions (overriding statuses, approving auto-submissions) require an authenticated risk analyst session for complete audit compliance.
                  </p>
                  <button
                    onClick={onOpenLogin}
                    className="bg-ink hover:bg-black text-white rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
                  >
                    Sign In as Reviewer
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReviewerSubmit} className="space-y-4 bg-surface p-5 rounded-xl border border-hairline">
                  <div className="flex items-center space-x-2 text-emerald-700 text-[13px] font-medium">
                    <UserCheck className="w-4 h-4" />
                    <span>Logged in as {reviewer?.name} ({reviewer?.email})</span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[13px] font-medium text-ink-secondary">Action Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReviewAction('APPROVE_SUBMISSION')}
                        className={`p-3 rounded-xl border text-left text-[13px] transition-colors ${
                          reviewAction === 'APPROVE_SUBMISSION'
                            ? 'bg-white border-ink text-ink font-medium'
                            : 'bg-white border-hairline text-ink-tertiary hover:text-ink-secondary'
                        }`}
                      >
                        <div className="font-medium">Approve Auto-Submission</div>
                        <div className="text-[11px] text-ink-tertiary mt-0.5">Move case to ready_to_submit</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewAction('OVERRIDE_STATUS')}
                        className={`p-3 rounded-xl border text-left text-[13px] transition-colors ${
                          reviewAction === 'OVERRIDE_STATUS'
                            ? 'bg-white border-ink text-ink font-medium'
                            : 'bg-white border-hairline text-ink-tertiary hover:text-ink-secondary'
                        }`}
                      >
                        <div className="font-medium">Override Status</div>
                        <div className="text-[11px] text-ink-tertiary mt-0.5">Manually change status</div>
                      </button>
                    </div>
                  </div>

                  {reviewAction === 'OVERRIDE_STATUS' && (
                    <div>
                      <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">New Status</label>
                      <select
                        value={overrideStatus}
                        onChange={(e) => setOverrideStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-hairline rounded-lg text-[13px] text-ink focus:outline-none focus:border-ink"
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
                    <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">
                      Reviewer Reason & Justification <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="Explain your operational decision for the audit log..."
                      className="w-full p-3 bg-white border border-hairline rounded-lg text-[13px] text-ink placeholder-ink-tertiary focus:outline-none focus:border-ink resize-none"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingReview || !reviewerNotes.trim()}
                      className="bg-ink hover:bg-black text-white rounded-full px-5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
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
                <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
                  Immutable Audit Log Trail
                </h4>
                <span className="text-[12px] text-ink-tertiary font-mono">
                  {auditLogs.length} events logged
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-[13px] text-ink-tertiary italic py-6 text-center">
                  No audit log entries recorded for this dispute yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const dateStr = new Date(log.created_at * 1000).toLocaleString('en-IN');
                    return (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl bg-white border border-hairline space-y-1.5 text-[13px]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-medium text-ink-secondary bg-surface px-2 py-0.5 rounded-full">
                              {log.action}
                            </span>
                            <span className="text-[11px] text-ink-tertiary">{dateStr}</span>
                          </div>
                          <span className="font-mono text-[11px] text-ink-tertiary">{log.id}</span>
                        </div>

                        <div className="text-ink font-medium">{log.decision}</div>

                        {log.reviewer_notes && (
                          <div className="text-[12px] text-ink-secondary bg-surface p-2 rounded-lg">
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
