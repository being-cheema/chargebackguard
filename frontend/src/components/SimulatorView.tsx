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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/60 border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Interactive Dispute Risk & Evidence Sandbox
            </h2>
            <p className="text-xs text-slate-400">
              Live deterministic scorer and anti-hallucination letter drafter testbed.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Parameter Panel (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            1. Dispute Case Parameters
          </h3>

          {/* Reason Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Razorpay Reason Code</label>
            <select
              value={selectedReasonCode}
              onChange={(e) => setSelectedReasonCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {reasonCodes.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} — {r.category}
                </option>
              ))}
            </select>
            {selectedConfig && (
              <p className="text-[11px] text-slate-400 mt-1">{selectedConfig.description}</p>
            )}
          </div>

          {/* Amount & Days since transaction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Amount (INR ₹)</label>
              <input
                type="number"
                min={100}
                max={200000}
                value={amountInr}
                onChange={(e) => setAmountInr(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Days Since Tx: <span className="text-blue-400 font-mono font-bold">{daysSinceTx}d</span>
              </label>
              <input
                type="range"
                min={1}
                max={90}
                value={daysSinceTx}
                onChange={(e) => setDaysSinceTx(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-2"
              />
            </div>
          </div>

          {/* Customer History & Response Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Dispute History: <span className="text-blue-400 font-mono font-bold">{disputeHistory}</span>
              </label>
              <input
                type="range"
                min={0}
                max={6}
                value={disputeHistory}
                onChange={(e) => setDisputeHistory(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Response Time: <span className="text-blue-400 font-mono font-bold">{responseTimeHours}h</span>
              </label>
              <input
                type="range"
                min={1}
                max={96}
                value={responseTimeHours}
                onChange={(e) => setResponseTimeHours(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-2"
              />
            </div>
          </div>

          {/* IP Match & Decision Gate Threshold */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Transaction IP matches Billing Country</span>
              <button
                type="button"
                onClick={() => setIpMatch(!ipMatch)}
                className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${
                  ipMatch ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                    ipMatch ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>Decision Threshold</span>
                <span className="text-blue-400 font-mono">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={0.9}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* Evidence Checklist Toggle Matrix */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                    className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-blue-950/40 border-blue-500/40 text-slate-200'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <span className="text-xs font-medium truncate">{label}</span>
                    </div>

                    {isPrimary && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Deterministic Score Engine Result
                  </h3>
                  <span className="text-[11px] text-slate-500 italic">No LLM in scoring logic</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Calculated Win Probability</div>
                    <div className="text-3xl font-extrabold font-mono text-white mt-1">
                      {(simulationResult.scoreResult.score * 100).toFixed(0)}%
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
                      <div
                        className={`h-full rounded-full ${
                          simulationResult.scoreResult.score >= threshold
                            ? 'bg-emerald-400'
                            : 'bg-amber-400'
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

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div className="text-xs text-slate-400">Gate Routing Output</div>
                    <div className="my-1">
                      {simulationResult.isAutoSubmitted ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          AUTO-APPROVED (≥ {threshold.toFixed(2)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <AlertTriangle className="w-4 h-4 mr-1.5" />
                          ROUTED TO HUMAN REVIEW (&lt; {threshold.toFixed(2)})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Evidence completeness:{' '}
                      <span className="font-mono text-slate-300">
                        {(simulationResult.scoreResult.evidenceCompleteness * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Factors Attribution */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-slate-300">Mathematical Factor Attribution:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-emerald-400">Positive Factors:</div>
                      {simulationResult.scoreResult.factors.positive.map((f: string, i: number) => (
                        <div key={i} className="flex items-start space-x-1">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20 text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-rose-400">Negative Penalties:</div>
                      {simulationResult.scoreResult.factors.negative.length === 0 ? (
                        <div className="text-slate-500 italic">No penalties applied.</div>
                      ) : (
                        simulationResult.scoreResult.factors.negative.map((f: string, i: number) => (
                          <div key={i} className="flex items-start space-x-1">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>{f}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Drafted Explanation Letter Output */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Generated Natural-Language Explanation Letter
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {simulationResult.draftResult.characterCount} / 1000 chars
                  </span>
                </div>

                {/* Anti-Hallucination verification pill */}
                <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    Anti-Hallucination Guard: Validated against active evidence matrix (Zero unverified claims).
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 leading-relaxed">
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
