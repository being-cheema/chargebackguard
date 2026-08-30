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

export const MetricsView: React.FC = () => {
  const [report, setReport] = useState<MetricEvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [simulatedThreshold, setSimulatedThreshold] = useState<number>(0.75);

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
    setRecalculating(true);
    try {
      const res = await api.recalculateMetrics();
      setReport(res.results);
    } catch (err) {
      console.error('Recalculation error:', err);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading || !report) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-semibold text-slate-300">Loading held-out evaluation report...</p>
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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/60 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Track 02: AI Risk Manager Evaluation
              </span>
              <span className="text-xs text-slate-400">
                Held-Out Test Set ({report.total_held_out_samples} cases / 30% fixed split)
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mt-2">
              Held-Out Test Set Metrics & Financial Risk Report
            </h2>
          </div>

          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all self-start md:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
            <span>{recalculating ? 'Evaluating...' : 'Re-Run Evaluation'}</span>
          </button>
        </div>

        {/* Framing callout */}
        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-slate-300 space-y-1.5">
          <div className="font-semibold text-blue-400 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Architectural Alignment: Why High Precision Is Required</span>
          </div>
          <p className="text-slate-300 leading-relaxed italic">
            "We tuned for high precision over high recall because a wrongly auto-contested dispute carries reputational and card-network penalty risk beyond its dollar cost, while a missed win still gets a second chance via human review."
          </p>
        </div>
      </div>

      {/* 4 Core Hero Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Precision */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Precision</div>
          <div className="text-4xl font-extrabold text-white mt-2 font-mono">
            {(m.precision * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            <span className="text-emerald-400 font-semibold">{cm.true_positives} won</span> out of {cm.true_positives + cm.false_positives} auto-contested
          </div>
          <div className="text-[10px] text-slate-500 mt-2">Extreme safety against false-positive network penalty risk</div>
        </div>

        {/* Recall */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-400">Recall</div>
          <div className="text-4xl font-extrabold text-white mt-2 font-mono">
            {(m.recall * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {cm.true_positives} captured / {cm.false_negatives} to review
          </div>
          <div className="text-[10px] text-slate-500 mt-2">Uncaptured cases safely routed to human queue (FN)</div>
        </div>

        {/* F1 Score */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">F1 Score</div>
          <div className="text-4xl font-extrabold text-white mt-2 font-mono">
            {m.f1_score.toFixed(3)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {(m.f1_score * 100).toFixed(1)}% Harmonic Balance
          </div>
          <div className="text-[10px] text-slate-500 mt-2">Automated throughput balanced with risk gating</div>
        </div>

        {/* Specificity */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">Specificity</div>
          <div className="text-4xl font-extrabold text-white mt-2 font-mono">
            {(m.specificity * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            <span className="text-cyan-400 font-semibold">{cm.true_negatives}</span> of {cm.true_negatives + cm.false_positives} weak cases caught
          </div>
          <div className="text-[10px] text-slate-500 mt-2">Effectively filters out unwinnable dispute attempts</div>
        </div>
      </div>

      {/* Confusion Matrix & Financial ROI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Held-Out Confusion Matrix */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Held-Out Confusion Matrix (135 Samples)
            </h3>
            <span className="text-xs text-slate-500">Fixed 30% Test Set</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* TP */}
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">True Positives (TP)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">{cm.true_positives}</div>
              <div className="text-[11px] text-slate-400">
                High-evidence winnable disputes auto-approved with zero human delay.
              </div>
            </div>

            {/* FN */}
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400">False Negatives (FN)</span>
                <HelpCircle className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">{cm.false_negatives}</div>
              <div className="text-[11px] text-slate-400">
                Winnable cases routed to review queue (Safe: human analysts still evaluate them).
              </div>
            </div>

            {/* FP */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400">False Positives (FP)</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">{cm.false_positives}</div>
              <div className="text-[11px] text-slate-400">
                Weak cases incorrectly auto-submitted (Minimized by 0.75 threshold).
              </div>
            </div>

            {/* TN */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">True Negatives (TN)</span>
                <ShieldCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">{cm.true_negatives}</div>
              <div className="text-[11px] text-slate-400">
                Weak/unwinnable cases correctly routed to human review for manual evidence gathering.
              </div>
            </div>
          </div>
        </div>

        {/* Financial Risk & Auto-Recovery Scope */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Economic Impact (Auto-Approval Scope)
              </h3>
              <span className="text-xs text-emerald-400 font-semibold">Positive ROI</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Strictly scoped to the {cm.true_positives} auto-approved cases to avoid overstating standalone impact.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">Value Recovered via Auto-Approval (TP):</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">
                ₹{fi.value_recovered_via_auto_approval_inr.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">False-Positive Network/Ops Cost (FP × ₹4,000):</span>
              <span className="text-sm font-extrabold text-rose-400 font-mono">
                - ₹{fi.ops_and_network_penalty_cost_inr.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between items-center p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
              <span className="text-xs font-bold text-white">Net Economic Value Delivered (Auto Path):</span>
              <span className="text-base font-extrabold text-emerald-300 font-mono">
                ₹{fi.net_economic_benefit_auto_path_inr.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
              <span>Human Review Queue Volume (FN + TN):</span>
              <span className="font-mono text-slate-300">
                ₹{fi.human_review_queue_volume_inr.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Threshold Sensitivity Curve */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Decision Gate Threshold Sensitivity Curve
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate performance trade-offs across different operating thresholds.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">Threshold:</span>
            <span className="text-sm font-bold text-white font-mono">{simulatedThreshold.toFixed(2)}</span>
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
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>0.50 (Loose Auto-Approval)</span>
            <span className="text-blue-400 font-bold">0.75 (Active Operating Baseline)</span>
            <span>0.90 (Ultra-Conservative)</span>
          </div>
        </div>

        {/* Live Simulation Card for Selected Threshold */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950 border border-blue-500/20">
          <div>
            <div className="text-[11px] text-slate-400">Simulated Precision</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {(currentSimPoint.precision * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Simulated Recall</div>
            <div className="text-xl font-bold text-blue-400 font-mono mt-1">
              {(currentSimPoint.recall * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Auto-Submit Rate</div>
            <div className="text-xl font-bold text-indigo-400 font-mono mt-1">
              {(currentSimPoint.auto_submit_rate * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Simulated Net Benefit</div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              ₹{currentSimPoint.net_benefit_auto_inr.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Threshold Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase text-slate-400">
                <th className="py-3 px-4">Threshold</th>
                <th className="py-3 px-4">Precision</th>
                <th className="py-3 px-4">Recall</th>
                <th className="py-3 px-4">F1 Score</th>
                <th className="py-3 px-4">Auto-Submit Rate</th>
                <th className="py-3 px-4">Net Economic Benefit</th>
                <th className="py-3 px-4">Trade-Off Analysis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {report.threshold_sensitivity_curve.map((row) => {
                const isActive = Math.abs(row.threshold - 0.75) < 0.01;
                return (
                  <tr
                    key={row.threshold}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isActive ? 'bg-blue-600/10 font-bold' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded ${isActive ? 'bg-blue-500 text-white' : 'text-slate-300'}`}>
                        {row.threshold.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-emerald-400">{(row.precision * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-blue-400">{(row.recall * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-indigo-400">{row.f1.toFixed(3)}</td>
                    <td className="py-3 px-4 text-slate-300">{(row.auto_submit_rate * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-white">₹{row.net_benefit_auto_inr.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 font-sans text-xs text-slate-400">
                      {isActive
                        ? '🌟 Optimal balance: High precision with low false-positive penalty risk'
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Reason Code Performance Breakdown (Held-Out Set)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase text-slate-400">
                <th className="py-3 px-4">Reason Code</th>
                <th className="py-3 px-4">Total Cases</th>
                <th className="py-3 px-4">Actual Won</th>
                <th className="py-3 px-4">TP</th>
                <th className="py-3 px-4">FP</th>
                <th className="py-3 px-4">TN</th>
                <th className="py-3 px-4">FN</th>
                <th className="py-3 px-4">Precision</th>
                <th className="py-3 px-4">Recall</th>
                <th className="py-3 px-4">F1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {Object.entries(report.reason_code_performance).map(([code, stat]) => (
                <tr key={code} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-blue-400">{code}</td>
                  <td className="py-3 px-4 text-slate-300">{stat.total}</td>
                  <td className="py-3 px-4 text-emerald-400">{stat.won}</td>
                  <td className="py-3 px-4 text-emerald-300 font-bold">{stat.tp}</td>
                  <td className="py-3 px-4 text-rose-400">{stat.fp}</td>
                  <td className="py-3 px-4 text-slate-400">{stat.tn}</td>
                  <td className="py-3 px-4 text-blue-300">{stat.fn}</td>
                  <td className="py-3 px-4 text-emerald-400 font-bold">{(stat.precision * 100).toFixed(0)}%</td>
                  <td className="py-3 px-4 text-blue-400">{(stat.recall * 100).toFixed(0)}%</td>
                  <td className="py-3 px-4 text-indigo-400 font-bold">{stat.f1.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
