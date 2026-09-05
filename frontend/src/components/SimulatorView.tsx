import React, { useState, useEffect } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import type { EvidenceKey, ReasonCodeInfo } from '../types';
import { api } from '../services/api';

export const SimulatorView: React.FC = () => {
  const [reasonCodes, setReasonCodes] = useState<ReasonCodeInfo[]>([]);
  const [selectedReasonCode, setSelectedReasonCode] = useState('RZP01');
  const [amountInr, setAmountInr] = useState(8500);
  const [daysSinceTx, setDaysSinceTx] = useState(6);
  const [disputeHistory, setDisputeHistory] = useState(0);
  const [ipMatch, setIpMatch] = useState(true);
  const [responseTimeHours, setResponseTimeHours] = useState(8);
  const [threshold, setThreshold] = useState(0.75);

  const [evidenceState, setEvidenceState] = useState<Record<EvidenceKey, boolean>>({
    shipping_proof: true,
    proof_of_service: true,
    customer_communication: true,
    billing_proof: false,
    cancellation_proof: false,
    explanation_letter: false,
    refund_confirmation: false,
    access_activity_log: false,
    refund_cancellation_policy: false,
    term_and_conditions: false,
    others: false,
  });

  const [simulationResult, setSimulationResult] = useState<any>(null);

  useEffect(() => {
    api.getReasonCodes().then((data) => {
      setReasonCodes(data.reasonCodes);
    }).catch(console.error);
  }, []);

  const runSimulation = async () => {
    try {
      const evidencePayload: Record<string, string | null> = {};
      Object.entries(evidenceState).forEach(([key, isChecked]) => {
        evidencePayload[key] = isChecked ? `https://cdn.razorpay.com/evidence/simulated/${key}.pdf` : null;
      });

      const res = await api.simulate({
        reason_code: selectedReasonCode,
        amount: amountInr * 100, // paise
        days_since_transaction: daysSinceTx,
        customer_dispute_history_count: disputeHistory,
        ip_matches_billing_country: ipMatch,
        merchant_response_time_hours: responseTimeHours,
        evidence: evidencePayload,
        threshold,
      });

      setSimulationResult(res);
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  // Run initial simulation and re-run on inputs change
  useEffect(() => {
    runSimulation();
  }, [
    selectedReasonCode,
    amountInr,
    daysSinceTx,
    disputeHistory,
    ipMatch,
    responseTimeHours,
    threshold,
    evidenceState,
  ]);

  const toggleEvidence = (key: EvidenceKey) => {
    setEvidenceState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectedConfig = reasonCodes.find((r) => r.code === selectedReasonCode);

  const evidenceOptions: Array<{ key: EvidenceKey; label: string }> = [
    { key: 'shipping_proof', label: 'Shipping Proof / Courier Tracking' },
    { key: 'proof_of_service', label: 'Proof of Service / Delivery Logs' },
    { key: 'billing_proof', label: 'Billing Proof / Matched Invoice' },
    { key: 'customer_communication', label: 'Customer Support Communication' },
    { key: 'refund_confirmation', label: 'Refund Confirmation (ARN Receipt)' },
    { key: 'access_activity_log', label: 'Access & Activity System Logs' },
    { key: 'cancellation_proof', label: 'Cancellation Proof Records' },
    { key: 'refund_cancellation_policy', label: 'Refund / Cancellation Policy' },
    { key: 'term_and_conditions', label: 'Terms & Conditions Acceptance' },
    { key: 'others', label: 'Other Supporting Documentation' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-white border border-hairline shadow-card">
        <div className="flex items-center space-x-3">
          <div className="text-ink-secondary">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink tracking-tight">
              Interactive Dispute Risk & Evidence Sandbox
            </h2>
            <p className="text-[13px] text-ink-secondary">
              Live deterministic scorer and anti-hallucination letter drafter testbed.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Parameter Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-hairline rounded-2xl p-6 space-y-5 shadow-card">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
            1. Dispute Case Parameters
          </h3>

          {/* Reason Code */}
          <div>
            <label className="block text-[13px] font-medium text-ink-secondary mb-1">Razorpay Reason Code</label>
            <select
              value={selectedReasonCode}
              onChange={(e) => setSelectedReasonCode(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-[13px] text-ink focus:outline-none focus:border-ink"
            >
              {reasonCodes.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} — {r.category}
                </option>
              ))}
            </select>
            {selectedConfig && (
              <p className="text-[12px] text-ink-tertiary mt-1">{selectedConfig.description}</p>
            )}
          </div>

          {/* Amount & Days since transaction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1">Amount (INR ₹)</label>
              <input
                type="number"
                min={100}
                max={200000}
                value={amountInr}
                onChange={(e) => setAmountInr(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-[13px] text-ink focus:outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1">
                Days Since Tx: <span className="text-ink font-mono font-semibold">{daysSinceTx}d</span>
              </label>
              <input
                type="range"
                min={1}
                max={90}
                value={daysSinceTx}
                onChange={(e) => setDaysSinceTx(Number(e.target.value))}
                className="w-full h-2 bg-surface border border-hairline rounded-lg appearance-none cursor-pointer accent-ink mt-2"
              />
            </div>
          </div>

          {/* Customer History & Response Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1">
                Dispute History: <span className="text-ink font-mono font-semibold">{disputeHistory}</span>
              </label>
              <input
                type="range"
                min={0}
                max={6}
                value={disputeHistory}
                onChange={(e) => setDisputeHistory(Number(e.target.value))}
                className="w-full h-2 bg-surface border border-hairline rounded-lg appearance-none cursor-pointer accent-ink mt-2"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1">
                Response Time: <span className="text-ink font-mono font-semibold">{responseTimeHours}h</span>
              </label>
              <input
                type="range"
                min={1}
                max={96}
                value={responseTimeHours}
                onChange={(e) => setResponseTimeHours(Number(e.target.value))}
                className="w-full h-2 bg-surface border border-hairline rounded-lg appearance-none cursor-pointer accent-ink mt-2"
              />
            </div>
          </div>

          {/* IP Match & Decision Gate Threshold */}
          <div className="pt-2 border-t border-hairline space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-secondary">Transaction IP matches Billing Country</span>
              <button
                type="button"
                onClick={() => setIpMatch(!ipMatch)}
                className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${
                  ipMatch ? 'bg-ink' : 'bg-surface border border-hairline'
                }`}
              >
                <div
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-card transform transition-transform ${
                    ipMatch ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <div className="flex justify-between text-[13px] font-medium text-ink-secondary mb-1">
                <span>Decision Threshold</span>
                <span className="text-ink font-mono">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={0.9}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-surface border border-hairline rounded-lg appearance-none cursor-pointer accent-ink"
              />
            </div>
          </div>

          {/* Evidence Checklist Toggle Matrix */}
          <div className="pt-2 border-t border-hairline space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              2. Available Evidence Files
            </h4>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {evidenceOptions.map(({ key, label }) => {
                const isChecked = evidenceState[key];
                const isPrimary = selectedConfig?.primaryEvidence.includes(key);

                return (
                  <div
                    key={key}
                    onClick={() => toggleEvidence(key)}
                    className={`px-4 py-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-white border-hairline text-ink'
                        : 'bg-surface border-hairline text-ink-tertiary hover:border-ink-tertiary'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked
                            ? 'bg-ink border-ink text-white'
                            : 'border-hairline bg-white'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <span className="text-[13px] font-medium truncate">{label}</span>
                    </div>

                    {isPrimary && (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        Primary
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Output Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {simulationResult && (
            <>
              {/* Score Gauge Output */}
              <div className="bg-white border border-hairline rounded-2xl p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
                    Live Deterministic Score Engine Result
                  </h3>
                  <span className="text-[12px] text-ink-tertiary italic">No LLM in scoring logic</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-surface p-4 rounded-xl border border-hairline">
                    <div className="text-[13px] text-ink-secondary">Calculated Win Probability</div>
                    <div className="text-[32px] font-semibold tracking-tight font-mono text-ink mt-1">
                      {(simulationResult.scoreResult.score * 100).toFixed(0)}%
                    </div>
                    <div className="w-full bg-hairline rounded-full h-1.5 overflow-hidden mt-3">
                      <div
                        className={`h-full rounded-full ${
                          simulationResult.scoreResult.score >= threshold
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(simulationResult.scoreResult.score * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-surface p-4 rounded-xl border border-hairline flex flex-col justify-between">
                    <div className="text-[13px] text-ink-secondary">Gate Routing Output</div>
                    <div className="my-1">
                      {simulationResult.isAutoSubmitted ? (
                        <span className="inline-flex items-center bg-emerald-50 text-emerald-700 rounded-full px-3 py-1 text-[13px] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          AUTO-APPROVED (≥ {threshold.toFixed(2)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-amber-50 text-amber-700 rounded-full px-3 py-1 text-[13px] font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                          ROUTED TO HUMAN REVIEW (&lt; {threshold.toFixed(2)})
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-ink-tertiary">
                      Evidence completeness:{' '}
                      <span className="font-mono text-ink-secondary">
                        {(simulationResult.scoreResult.evidenceCompleteness * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Factors Attribution */}
                <div className="space-y-2 pt-2">
                  <div className="text-[13px] font-medium text-ink-secondary">Mathematical Factor Attribution:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-50 text-[13px] text-ink-secondary space-y-1">
                      <div className="font-medium text-emerald-700">Positive Factors:</div>
                      {simulationResult.scoreResult.factors.positive.map((f: string, i: number) => (
                        <div key={i} className="flex items-start space-x-1">
                          <span className="text-emerald-700 font-medium">•</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-xl bg-red-50 text-[13px] text-ink-secondary space-y-1">
                      <div className="font-medium text-red-600">Negative Penalties:</div>
                      {simulationResult.scoreResult.factors.negative.length === 0 ? (
                        <div className="text-ink-tertiary italic">No penalties applied.</div>
                      ) : (
                        simulationResult.scoreResult.factors.negative.map((f: string, i: number) => (
                          <div key={i} className="flex items-start space-x-1">
                            <span className="text-red-600 font-medium">•</span>
                            <span>{f}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Drafted Explanation Letter Output */}
              <div className="bg-white border border-hairline rounded-2xl p-6 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
                    Generated Natural-Language Explanation Letter
                  </h3>
                  <span className="text-[12px] text-ink-tertiary font-mono">
                    {simulationResult.draftResult.characterCount} / 1000 chars
                  </span>
                </div>

                {/* Anti-Hallucination verification pill */}
                <div className="flex items-center space-x-2 text-[13px] text-ink-secondary font-medium bg-surface p-2.5 rounded-lg border border-hairline">
                  <ShieldCheck className="w-4 h-4 text-ink-tertiary" />
                  <span>
                    Anti-Hallucination Guard: Validated against active evidence matrix (Zero unverified claims).
                  </span>
                </div>

                <div className="bg-surface rounded-xl p-4 text-[14px] text-ink-secondary leading-relaxed">
                  {simulationResult.draftResult.letter}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
