import React, { useEffect, useState } from 'react';
import {
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Webhook,
  Send,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { RazorpayPaymentRecord, WebhookEventRecord } from '../types';

interface IntegrationViewProps {
  onOpenLogin: () => void;
}

export const IntegrationView: React.FC<IntegrationViewProps> = ({ onOpenLogin }) => {
  const { token, isAuthenticated } = useAuth();

  const [status, setStatus] = useState<{
    configured: boolean;
    contestMode: 'submit' | 'draft_only';
    capturedPaymentsCount: number;
    docsUrl: string;
  } | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<{
    webhookEndpoint: string;
    simulateEndpoint: string;
    razorpayConfigured: boolean;
    contestMode: 'submit' | 'draft_only';
    note: string;
  } | null>(null);
  const [payments, setPayments] = useState<RazorpayPaymentRecord[]>([]);
  const [events, setEvents] = useState<WebhookEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [simPaymentId, setSimPaymentId] = useState('');
  const [simReasonCode, setSimReasonCode] = useState('goods_or_services_not_provided');
  const [simAmount, setSimAmount] = useState<number>(50000);

  const load = async () => {
    setLoading(true);
    try {
      const [statusRes, webhookRes, paymentsRes, eventsRes] = await Promise.all([
        api.getRazorpayStatus(),
        api.getWebhookStatus(),
        api.getRazorpayPayments(),
        api.getRazorpayWebhookEvents(20),
      ]);
      setStatus(statusRes);
      setWebhookStatus(webhookRes);
      setPayments((paymentsRes as any).payments || []);
      setEvents(eventsRes.events);
      if (!simPaymentId && (paymentsRes as any).payments?.length) {
        setSimPaymentId((paymentsRes as any).payments[0].payment_id);
      }
    } catch (err) {
      console.error('Failed to load Razorpay integration status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (!isAuthenticated || !token) {
      onOpenLogin();
      return;
    }
    setSyncing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await api.syncRazorpayDisputes(token);
      setActionMessage(res.message);
      await load();
    } catch (err: any) {
      setActionError(err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSimulate = async () => {
    if (!isAuthenticated || !token) {
      onOpenLogin();
      return;
    }
    setSimulating(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await api.simulateWebhook(
        { payment_id: simPaymentId, amount: simAmount, reason_code: simReasonCode, status: 'open' },
        token
      );
      setActionMessage(`${res.message} (event: ${res.event})`);
      await load();
    } catch (err: any) {
      setActionError(err.message || 'Simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-ink-tertiary flex flex-col items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin mb-3" />
        <span className="text-[14px]">Loading Razorpay integration status…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight text-ink flex items-center gap-2">
          <Zap className="w-5 h-5 text-ink-secondary" />
          Razorpay Integration
        </h2>
        <p className="text-ink-secondary text-[14px] mt-1.5 max-w-2xl leading-relaxed">
          Real Disputes, Documents, and Webhooks API wiring — not a mock. Live-fetches captured test-mode
          payments, signs and verifies webhook signatures with HMAC-SHA256, and can submit contest evidence
          back to Razorpay when a dispute is decision-gated.
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl bg-red-50 text-red-600 px-4 py-3 text-[13px]">{actionError}</div>
      )}
      {actionMessage && (
        <div className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-[13px]">{actionMessage}</div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-hairline rounded-2xl p-5">
          <div className="text-[12px] text-ink-tertiary mb-2">API Credentials</div>
          <div className="flex items-center gap-2">
            {status?.configured ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span className="text-[17px] font-semibold text-ink">
              {status?.configured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <a
            href={status?.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-accent hover:text-accent-hover mt-2 inline-flex items-center gap-1"
          >
            Disputes API docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="bg-white border border-hairline rounded-2xl p-5">
          <div className="text-[12px] text-ink-tertiary mb-2">Contest Mode</div>
          <div className="text-[17px] font-semibold text-ink">
            {status?.contestMode === 'submit' ? 'Live submit' : 'Draft only'}
          </div>
          <div className="text-[12px] text-ink-tertiary mt-2 leading-relaxed">
            {status?.contestMode === 'submit'
              ? 'Contests are sent live to Razorpay.'
              : 'Test-mode disputes cannot be contested via API — evidence is drafted and staged.'}
          </div>
        </div>

        <div className="bg-white border border-hairline rounded-2xl p-5">
          <div className="text-[12px] text-ink-tertiary mb-2">Captured Payments</div>
          <div className="text-[17px] font-semibold text-ink">{status?.capturedPaymentsCount ?? 0}</div>
          <div className="text-[12px] text-ink-tertiary mt-2">Real test-mode payment IDs pulled into the dataset</div>
        </div>
      </div>

      {/* Webhook status + simulate */}
      <div className="bg-white border border-hairline rounded-2xl p-6">
        <h3 className="font-semibold text-ink mb-1 flex items-center gap-2 text-[15px]">
          <Webhook className="w-4 h-4 text-ink-secondary" />
          Webhooks
        </h3>
        <p className="text-[13px] text-ink-tertiary mb-5">{webhookStatus?.note}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-5">
          <div className="bg-surface rounded-lg px-3 py-2.5">
            <div className="text-[11px] text-ink-tertiary">Webhook endpoint</div>
            <div className="font-mono text-[12px] text-ink truncate">{webhookStatus?.webhookEndpoint}</div>
          </div>
          <div className="bg-surface rounded-lg px-3 py-2.5">
            <div className="text-[11px] text-ink-tertiary">Simulate endpoint (auth)</div>
            <div className="font-mono text-[12px] text-ink truncate">{webhookStatus?.simulateEndpoint}</div>
          </div>
        </div>

        {!isAuthenticated && (
          <div className="flex items-center gap-2 text-[12px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5 mb-5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Sign in as a reviewer to sync live disputes or simulate an inbound webhook.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-ink-tertiary mb-1.5">Payment ID</label>
            <select
              value={simPaymentId}
              onChange={(e) => setSimPaymentId(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink"
            >
              {payments.map((p) => (
                <option key={p.payment_id} value={p.payment_id}>
                  {p.payment_id} (₹{(p.amount / 100).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-ink-tertiary mb-1.5">Reason Code</label>
            <input
              value={simReasonCode}
              onChange={(e) => setSimReasonCode(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block text-[11px] text-ink-tertiary mb-1.5">Amount (paise)</label>
            <input
              type="number"
              value={simAmount}
              onChange={(e) => setSimAmount(Number(e.target.value))}
              className="w-full bg-surface border border-hairline rounded-lg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleSimulate}
            disabled={simulating || !simPaymentId}
            className="flex items-center gap-2 bg-ink hover:bg-black disabled:opacity-50 text-white font-medium px-4 py-2 rounded-full text-[13px] transition-colors"
          >
            {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Simulate Dispute Webhook
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-white border border-hairline hover:bg-surface disabled:opacity-50 text-ink font-medium px-4 py-2 rounded-full text-[13px] transition-colors"
          >
            {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync Live Disputes
          </button>
        </div>
      </div>

      {/* Recent webhook events */}
      <div className="bg-white border border-hairline rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-hairline">
          <h3 className="font-semibold text-ink text-[15px]">
            Recent Webhook Events <span className="text-ink-tertiary font-normal">({events.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-[14px]">
            <thead className="sticky top-0 bg-white">
              <tr className="text-ink-tertiary text-[12px] border-b border-hairline">
                <th className="text-left font-medium px-6 py-3">Event</th>
                <th className="text-left font-medium px-6 py-3">Dispute ID</th>
                <th className="text-left font-medium px-6 py-3">Signature</th>
                <th className="text-left font-medium px-6 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-ink-tertiary text-[13px]">
                    No webhook events yet. Simulate one above.
                  </td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.id} className="border-b border-hairline last:border-0 hover:bg-surface/60">
                  <td className="px-6 py-3 font-mono text-[12px] text-ink-secondary">{e.event_type}</td>
                  <td className="px-6 py-3 font-mono text-[12px] text-ink-secondary">{e.dispute_id || '—'}</td>
                  <td className="px-6 py-3">
                    {e.signature_valid ? (
                      <span className="text-emerald-700 text-[12px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                      </span>
                    ) : (
                      <span className="text-red-600 text-[12px] flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Invalid
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-[12px] text-ink-tertiary">
                    {new Date(e.created_at * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments */}
      <div className="bg-white border border-hairline rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-hairline">
          <h3 className="font-semibold text-ink text-[15px]">
            Captured Test-Mode Payments <span className="text-ink-tertiary font-normal">({payments.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-[14px]">
            <thead className="sticky top-0 bg-white">
              <tr className="text-ink-tertiary text-[12px] border-b border-hairline">
                <th className="text-left font-medium px-6 py-3">Payment ID</th>
                <th className="text-right font-medium px-6 py-3">Amount</th>
                <th className="text-left font-medium px-6 py-3">Method</th>
                <th className="text-left font-medium px-6 py-3">Dispute Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.payment_id} className="border-b border-hairline last:border-0 hover:bg-surface/60">
                  <td className="px-6 py-3 font-mono text-[12px] text-ink-secondary">{p.payment_id}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-ink">₹{(p.amount / 100).toFixed(2)}</td>
                  <td className="px-6 py-3 text-ink-secondary">{p.method}</td>
                  <td className="px-6 py-3 text-ink-tertiary text-[12px]">{p.dispute_status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
