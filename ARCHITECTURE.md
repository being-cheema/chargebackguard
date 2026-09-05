# ChargebackGuard Architecture

> Razorpay AI Buildathon — Track 02: AI Risk Manager

## Overview

ChargebackGuard is a defense-only dispute ops copilot. Financial decisions are **100% deterministic**; LLMs only draft natural-language explanation letters under strict anti-hallucination validation.

## Data Flow

```
Razorpay Webhook / Sync API / Simulator
        ↓
  Dispute Ingestion (normalize → PostgreSQL)
        ↓
  Deterministic Scorer (rules + weights, zero LLM)
        ↓
  Decision Gate (threshold 0.75)
        ├─ score ≥ 0.75 → ready_to_submit
        └─ score < 0.75 → needs_human_review
        ↓
  Bounded LLM Drafter (Claude or fallback template)
        ↓
  Anti-Hallucination Validator (regex + char limit)
        ↓
  Razorpay Contest API (PATCH /v1/disputes/:id/contest, action=draft)
        ↓
  Immutable Audit Trail
```

## Razorpay Integration

| Component | Endpoint | Notes |
|-----------|----------|-------|
| Webhook ingest | `POST /api/webhooks/razorpay` | HMAC-SHA256 signature verification |
| Demo simulator | `POST /api/webhooks/simulate` | JWT-protected; fires `payment.dispute.created` |
| Live sync | `POST /api/razorpay/sync` | `GET /v1/disputes` from test account |
| Contest submit | `POST /api/razorpay/disputes/:id/contest` | Documents API + contest draft |
| Payments | `GET /api/razorpay/payments` | 9 real captured `pay_*` test transactions |

**Important:** Razorpay cannot create disputes in test mode (banks initiate them). The webhook simulator provides a credible demo path.

## Evaluation Honesty

- **450 synthetic disputes** with fixed 70/30 train/held-out split (`data/split_manifest.json`)
- **Labels are synthetic** — generated from domain rules + noise, not real dispute outcomes
- Metrics measure routing quality on synthetic data, not production win rates
- Verify integrity: `npm run evaluate:integrity`

## Security

- JWT auth on all mutating endpoints
- Public API strips `ground_truth_outcome` and `split`
- Webhook signature validation on raw body
- `RAZORPAY_CONTEST_MODE=draft` by default (safe for demos)

## Quick Start

```bash
# From repo root
npm install && npm install --prefix backend && npm install --prefix frontend
cd backend && npm run seed -- --payments && npm run evaluate
npm run dev  # backend :5050 + frontend :5180 (from root: npm run dev after installing concurrently)
```

Reviewer login: `analyst@razorpay.com` / `Chargeback@2026`
