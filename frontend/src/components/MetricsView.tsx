import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import type { MetricEvaluationReport } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const MetricsView: React.FC = () => {
  const { token, isAuthenticated } = useAuth();
  const [report, setReport] = useState<MetricEvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [simulatedThreshold, setSimulatedThreshold] = useState<number>(0.75);
  const [evalError, setEvalError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await api.getMetrics();
      setReport(data);
      setSimulatedThreshold(data.threshold_used);
    } catch (err) {
      console.error('Failed to load metrics report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRecalculate = async () => {
    if (!isAuthenticated || !token) {
      setEvalError('Please sign in as a reviewer to re-run held-out evaluation.');
      return;
    }
    setRecalculating(true);
    setEvalError(null);
    try {
      const res = await api.recalculateMetrics(token);
      setReport(res.results);
    } catch (err: any) {
      console.error('Recalculation error:', err);
      setEvalError(err.message || 'Evaluation failed.');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading || !report) {
    return (
      <div className="p-12 text-center text-ink-tertiary flex flex-col items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-ink-tertiary mb-3" />
        <p className="text-[13px] font-medium text-ink-tertiary">Loading held-out evaluation report...</p>
      </div>
    );
  }

  const { metrics: m, confusion_matrix: cm, financial_impact: fi } = report;

  // Selected simulation point from threshold sensitivity curve
  const currentSimPoint =
    report.threshold_sensitivity_curve.find(
      (pt) => Math.abs(pt.threshold - simulatedThreshold) < 0.01
    ) || report.threshold_sensitivity_curve.find((pt) => pt.threshold === 0.75)!;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner & Philosophy */}
      <div className="p-6 rounded-2xl bg-white border border-hairline shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide bg-surface text-ink-secondary border border-hairline">
                Track 02: AI Risk Manager Evaluation
              </span>
              <span className="text-[12px] text-ink-tertiary">
                Held-Out Test Set ({report.total_held_out_samples} cases / 30% fixed split)
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-ink tracking-tight mt-2">
              Held-Out Test Set Metrics &amp; Financial Risk Report
            </h2>
          </div>

          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center space-x-1.5 bg-ink hover:bg-black text-white rounded-full px-4 py-2 text-[13px] font-medium transition-colors self-start md:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
            <span>{recalculating ? 'Evaluating...' : 'Re-Run Evaluation'}</span>
          </button>
        </div>

        {evalError && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-[12px] flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-700" />
            <span>{evalError}</span>
          </div>
        )}

        {/* Framing callout */}
        <div className="bg-surface rounded-xl p-4 text-[13px] text-ink-secondary space-y-1.5">
          <div className="font-medium text-ink flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-ink-secondary" />
            <span>Architectural Alignment: Why High Precision Is Required</span>
          </div>
          <p className="italic leading-relaxed">
            "We tuned for high precision over high recall because a wrongly auto-contested dispute carries reputational and card-network penalty risk beyond its dollar cost, while a missed win still gets a second chance via human review."
          </p>
        </div>
      </div>

      {/* 4 Core Hero Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Precision */}
        <div className="bg-white border border-hairline p-5 rounded-2xl">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Precision</div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-ink mt-2">
            {(m.precision * 100).toFixed(1)}%
          </div>
          <div className="text-[12px] text-ink-secondary mt-1">
            <span className="text-emerald-700 font-medium">{cm.true_positives} won</span> out of {cm.true_positives + cm.false_positives} auto-contested
          </div>
          <div className="text-[12px] text-ink-tertiary mt-2">Extreme safety against false-positive network penalty risk</div>
        </div>

        {/* Recall */}
        <div className="bg-white border border-hairline p-5 rounded-2xl">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Recall</div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-ink mt-2">
            {(m.recall * 100).toFixed(1)}%
          </div>
          <div className="text-[12px] text-ink-secondary mt-1">
            {cm.true_positives} captured / {cm.false_negatives} to review
          </div>
          <div className="text-[12px] text-ink-tertiary mt-2">Uncaptured cases safely routed to human queue (FN)</div>
        </div>

        {/* F1 Score */}
        <div className="bg-white border border-hairline p-5 rounded-2xl">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">F1 Score</div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-ink mt-2">
            {m.f1_score.toFixed(3)}
          </div>
          <div className="text-[12px] text-ink-secondary mt-1">
            {(m.f1_score * 100).toFixed(1)}% Harmonic Balance
          </div>
          <div className="text-[12px] text-ink-tertiary mt-2">Automated throughput balanced with risk gating</div>
        </div>

        {/* Specificity */}
        <div className="bg-white border border-hairline p-5 rounded-2xl">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">Specificity</div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-ink mt-2">
            {(m.specificity * 100).toFixed(1)}%
          </div>
          <div className="text-[12px] text-ink-secondary mt-1">
            <span className="text-ink font-medium">{cm.true_negatives}</span> of {cm.true_negatives + cm.false_positives} weak cases caught
          </div>
          <div className="text-[12px] text-ink-tertiary mt-2">Effectively filters out unwinnable dispute attempts</div>
        </div>
      </div>

      {/* Confusion Matrix & Financial ROI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Held-Out Confusion Matrix */}
        <div className="bg-white border border-hairline p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary">
              Held-Out Confusion Matrix (135 Samples)
            </h3>
            <span className="text-[12px] text-ink-tertiary">Fixed 30% Test Set</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* TP */}
            <div className="bg-surface rounded-xl p-4 text-center space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ink-tertiary uppercase tracking-wide">True Positives (TP)</span>
                <CheckCircle2 className="w-4 h-4 text-ink-tertiary" />
              </div>
              <div className="text-[24px] font-semibold text-emerald-700 text-left">{cm.true_positives}</div>
              <div className="text-[11px] text-ink-tertiary text-left">
                High-evidence winnable disputes auto-approved with zero human delay.
              </div>
            </div>

            {/* FN */}
            <div className="bg-surface rounded-xl p-4 text-center space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ink-tertiary uppercase tracking-wide">False Negatives (FN)</span>
                <HelpCircle className="w-4 h-4 text-ink-tertiary" />
              </div>
              <div className="text-[24px] font-semibold text-ink text-left">{cm.false_negatives}</div>
              <div className="text-[11px] text-ink-tertiary text-left">
                Winnable cases routed to review queue (Safe: human analysts still evaluate them).
              </div>
            </div>

            {/* FP */}
            <div className="bg-surface rounded-xl p-4 text-center space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ink-tertiary uppercase tracking-wide">False Positives (FP)</span>
                <AlertTriangle className="w-4 h-4 text-ink-tertiary" />
              </div>
              <div className="text-[24px] font-semibold text-red-600 text-left">{cm.false_positives}</div>
              <div className="text-[11px] text-ink-tertiary text-left">
                Weak cases incorrectly auto-submitted (Minimized by 0.75 threshold).
              </div>
            </div>

            {/* TN */}
            <div className="bg-surface rounded-xl p-4 text-center space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ink-tertiary uppercase tracking-wide">True Negatives (TN)</span>
                <ShieldCheck className="w-4 h-4 text-ink-tertiary" />
              </div>
              <div className="text-[24px] font-semibold text-ink text-left">{cm.true_negatives}</div>
              <div className="text-[11px] text-ink-tertiary text-left">
                Weak/unwinnable cases correctly routed to human review for manual evidence gathering.
              </div>
            </div>
          </div>
        </div>

        {/* Financial Risk & Auto-Recovery Scope */}
        <div className="bg-white border border-hairline p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary">
                Economic Impact (Auto-Approval Scope)
              </h3>
              <span className="text-[12px] text-emerald-700 font-medium">Positive ROI</span>
            </div>
            <p className="text-[12px] text-ink-tertiary mt-1">
              Strictly scoped to the {cm.true_positives} auto-approved cases to avoid overstating standalone impact.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center py-2.5 border-b border-hairline">
              <span className="text-[13px] text-ink-secondary">Value Recovered via Auto-Approval (TP)</span>
              <span className="text-[14px] font-medium text-ink tabular-nums">
                ₹{fi.value_recovered_via_auto_approval_inr.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-hairline">
              <span className="text-[13px] text-ink-secondary">False-Positive Network/Ops Cost (FP × ₹4,000)</span>
              <span className="text-[14px] font-medium text-red-600 tabular-nums">
                − ₹{fi.ops_and_network_penalty_cost_inr.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-hairline">
              <span className="text-[13px] font-medium text-ink">Net Economic Value Delivered (Auto Path)</span>
              <span className="text-[15px] font-semibold text-emerald-700 tabular-nums">
                ₹{fi.net_economic_benefit_auto_path_inr.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 last:border-0">
              <span className="text-[12px] text-ink-tertiary">Human Review Queue Volume (FN + TN)</span>
              <span className="text-[13px] text-ink-secondary tabular-nums">
                ₹{fi.human_review_queue_volume_inr.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Threshold Sensitivity Curve */}
      <div className="bg-white border border-hairline p-6 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary">
              Decision Gate Threshold Sensitivity Curve
            </h3>
            <p className="text-[12px] text-ink-tertiary mt-0.5">
              Simulate performance trade-offs across different operating thresholds.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-surface px-4 py-2 rounded-xl border border-hairline">
            <Sliders className="w-4 h-4 text-ink-tertiary" />
            <span className="text-[12px] text-ink-tertiary">Threshold:</span>
            <span className="text-[13px] font-semibold text-ink tabular-nums">{simulatedThreshold.toFixed(2)}</span>
          </div>
        </div>

        {/* Interactive Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min={0.5}
            max={0.9}
            step={0.05}
            value={simulatedThreshold}
            onChange={(e) => setSimulatedThreshold(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-surface rounded-full appearance-none cursor-pointer accent-ink"
          />
          <div className="flex justify-between text-[11px] text-ink-tertiary tabular-nums">
            <span>0.50 (Loose Auto-Approval)</span>
            <span className="text-ink font-medium">0.75 (Active Operating Baseline)</span>
            <span>0.90 (Ultra-Conservative)</span>
          </div>
        </div>

        {/* Live Simulation Card for Selected Threshold */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface">
          <div>
            <div className="text-[11px] text-ink-tertiary">Simulated Precision</div>
            <div className="text-[18px] font-semibold text-ink tabular-nums mt-1">
              {(currentSimPoint.precision * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-ink-tertiary">Simulated Recall</div>
            <div className="text-[18px] font-semibold text-ink tabular-nums mt-1">
              {(currentSimPoint.recall * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-ink-tertiary">Auto-Submit Rate</div>
            <div className="text-[18px] font-semibold text-ink tabular-nums mt-1">
              {(currentSimPoint.auto_submit_rate * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-ink-tertiary">Simulated Net Benefit</div>
            <div className="text-[18px] font-semibold text-ink tabular-nums mt-1">
              ₹{currentSimPoint.net_benefit_auto_inr.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Threshold Table */}
        <div className="bg-white border border-hairline rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-hairline text-[12px] font-medium uppercase text-ink-tertiary">
                <th className="py-3 px-4">Threshold</th>
                <th className="py-3 px-4 text-right">Precision</th>
                <th className="py-3 px-4 text-right">Recall</th>
                <th className="py-3 px-4 text-right">F1 Score</th>
                <th className="py-3 px-4 text-right">Auto-Submit Rate</th>
                <th className="py-3 px-4 text-right">Net Economic Benefit</th>
                <th className="py-3 px-4">Trade-Off Analysis</th>
              </tr>
            </thead>
            <tbody>
              {report.threshold_sensitivity_curve.map((row) => {
                const isActive = Math.abs(row.threshold - 0.75) < 0.01;
                return (
                  <tr
                    key={row.threshold}
                    className={`border-b border-hairline last:border-0 hover:bg-surface/60 transition-colors tabular-nums ${
                      isActive ? 'bg-surface' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full ${isActive ? 'bg-ink text-white' : 'text-ink-secondary'}`}>
                        {row.threshold.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-ink">{(row.precision * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right text-ink">{(row.recall * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right text-ink">{row.f1.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-ink-secondary">{(row.auto_submit_rate * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right text-ink font-medium">₹{row.net_benefit_auto_inr.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 font-sans text-[12px] text-ink-tertiary">
                      {isActive
                        ? 'Optimal balance: High precision with low false-positive penalty risk'
                        : row.threshold < 0.75
                        ? 'Higher volume auto-submitted, but higher false-positive penalty risk'
                        : 'High precision, but underutilizes automation by routing too many cases to humans'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reason Code Breakdown Table */}
      <div className="bg-white border border-hairline rounded-2xl p-6 space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-secondary">
          Reason Code Performance Breakdown (Held-Out Set)
        </h3>

        <div className="bg-white border border-hairline rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-hairline text-[12px] font-medium uppercase text-ink-tertiary">
                <th className="py-3 px-4">Reason Code</th>
                <th className="py-3 px-4 text-right">Total Cases</th>
                <th className="py-3 px-4 text-right">Actual Won</th>
                <th className="py-3 px-4 text-right">TP</th>
                <th className="py-3 px-4 text-right">FP</th>
                <th className="py-3 px-4 text-right">TN</th>
                <th className="py-3 px-4 text-right">FN</th>
                <th className="py-3 px-4 text-right">Precision</th>
                <th className="py-3 px-4 text-right">Recall</th>
                <th className="py-3 px-4 text-right">F1</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.reason_code_performance).map(([code, stat]) => (
                <tr key={code} className="border-b border-hairline last:border-0 hover:bg-surface/60 transition-colors tabular-nums">
                  <td className="py-3 px-4 font-medium text-ink">{code}</td>
                  <td className="py-3 px-4 text-right text-ink-secondary">{stat.total}</td>
                  <td className="py-3 px-4 text-right text-ink-secondary">{stat.won}</td>
                  <td className="py-3 px-4 text-right text-emerald-700 font-medium">{stat.tp}</td>
                  <td className="py-3 px-4 text-right text-red-600">{stat.fp}</td>
                  <td className="py-3 px-4 text-right text-ink-secondary">{stat.tn}</td>
                  <td className="py-3 px-4 text-right text-ink-secondary">{stat.fn}</td>
                  <td className="py-3 px-4 text-right text-ink font-medium">{(stat.precision * 100).toFixed(0)}%</td>
                  <td className="py-3 px-4 text-right text-ink">{(stat.recall * 100).toFixed(0)}%</td>
                  <td className="py-3 px-4 text-right text-ink font-medium">{stat.f1.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
