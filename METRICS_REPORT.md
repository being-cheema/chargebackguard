# ChargebackGuard — Held-Out Test Set Evaluation Report

> **Razorpay AI Buildathon — Track 02: AI Risk Manager**  
> **Evaluation Timestamp**: `2026-09-05T17:47:19.827Z`  
> **Held-Out Test Sample Size**: **135 cases** (Fixed 30% split from `data/split_manifest.json`)  
> **Active Decision Gate Operating Threshold**: **`0.75`**

---

## 1. Architectural Philosophy: Why High Precision Is Required

> **Core Design Principle**:  
> *"We tuned for high precision over high recall because a wrongly auto-contested dispute carries reputational and card-network penalty risk beyond its dollar cost, while a missed win still gets a second chance via human review."*

When the system auto-submits a dispute response, it must be virtually certain of its evidence. A False Positive (auto-contesting a weak or losing claim) risks card network dispute arbitration fees and merchant monitoring flags. In contrast, False Negatives (cases falling below 0.75) are **not lost** — they are safely held in the `needs_human_review` dashboard queue where human analysts review and supplement them.

---

## 2. Executive Summary & Core Metrics

| Metric | Score | Percentage | Evaluation Assessment |
| :--- | :---: | :---: | :--- |
| **Precision** | **`0.923`** | **92.3%** | **36 wins out of 39 auto-submissions**. Only 3 false positives out of all automated submissions. |
| **Recall** | **`0.462`** | **46.2%** | Proportion of winnable disputes auto-approved (remainder routed safely to human queue). |
| **F1 Score** | **`0.615`** | **61.5%** | Harmonic balance between automated throughput and safety. |
| **Accuracy** | **`0.667`** | **66.7%** | Overall correct classification across auto-submit and human-review buckets. |
| **Specificity** | **`0.947`** | **94.7%** | **54 out of 57 losing/fraudulent cases** successfully caught and held back from auto-submission. |

---

## 3. Held-Out Confusion Matrix

```
                       ┌─────────────────────────┬─────────────────────────┐
                       │  Predicted AUTO_SUBMIT  │ Predicted HUMAN_REVIEW  │
┌──────────────────────┼─────────────────────────┼─────────────────────────┤
│ Actual Outcome: WON  │   TP = 36              │   FN = 42              │
├──────────────────────┼─────────────────────────┼─────────────────────────┤
│ Actual Outcome: LOST │   FP = 3               │   TN = 54              │
└──────────────────────┴─────────────────────────┴─────────────────────────┘
```

- **True Positives (TP = 36)**: High-evidence winnable disputes auto-submitted with 0 human touches.
- **False Positives (FP = 3)**: Only 3 cases with marginal proof incorrectly auto-submitted (minimized by 0.75 threshold).
- **True Negatives (TN = 54)**: Weak/unwinnable cases correctly routed to human review for manual evidence gathering.
- **False Negatives (FN = 42)**: Winnable disputes with partial evidence routed to human queue (safe fallback — human analysts complete the evidence package).

---

## 4. Financial Impact Analysis (Auto-Approval Scope)

### Economic Assumptions & Scope
1. **Scope**: All recovery figures below are **strictly scoped to the 36 auto-approved (TP) cases**, avoiding any overstatement of system impact. The ₹35,54,752 volume in the human review queue is handled collaboratively by risk analysts.
2. **False Positive Cost (₹4,000)**: ₹1,500 ops review cost + ₹2,500 card-network dispute filing/arbitration penalty risk.

| Financial Impact Metric | Value (INR) | Notes |
| :--- | :---: | :--- |
| **Total Held-Out Dispute Volume** | ₹45,22,274 | Total value of 135 disputes in held-out test set |
| **Value Recovered via Auto-Approval Path (TP)** | **₹8,77,785** | Direct cash recovery with zero manual labor |
| **False-Positive Network/Ops Cost** | ₹12,000 | 3 FP cases × ₹4,000 penalty |
| **Net Economic Benefit (Auto-Path)** | **₹8,65,785** | Immediate net value added solely from automation |
| **Human Review Queue Volume (FN + TN)** | ₹35,54,752 | Preserved for human analyst evaluation & secondary enrichment |

---

## 5. Threshold Sensitivity & Decision Gate Justification

Why is **0.75** the optimal operating threshold compared to lower or higher thresholds?

| Operating Threshold | Precision | Recall | F1 Score | Auto-Submit Rate | Auto-Recovered (₹) | Net Economic Benefit (₹) | Trade-Off Rationale |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `0.60` | 85.5% | 60.3% | **0.707** | 40.7% | ₹11,53,814 | ₹11,21,814 | Higher auto-recovery, but FP rate rises to 14.5% (8 losing cases auto-submitted), risking card network ratio warnings. |
| **`0.75` (Active)** | **92.3%** | **46.2%** | **`0.615`** | **28.9%** | **₹8,77,785** | **₹8,65,785** | 🌟 **Optimal operating point**: Extreme precision (92.3%), negligible FP risk (only 3 cases), safely offloading 28.9% of total dispute volume. |
| `0.85` | 90.0% | 34.6% | **0.500** | 22.2% | ₹7,77,529 | ₹7,65,529 | Overly conservative: suppresses automation throughput without meaningfully improving precision over 0.75. |

---

## 6. Reason Code Performance Breakdown

| Reason Code | Category | Total Cases | Actual Won | TP | FP | TN | FN | Precision | Recall | F1 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`1061`** | Dispute Code | 13 | 6 | 2 | 0 | 7 | 4 | 100% | 33% | **0.5** |
| **`1062`** | Dispute Code | 10 | 7 | 3 | 1 | 2 | 4 | 75% | 43% | **0.545** |
| **`1064`** | Dispute Code | 12 | 7 | 1 | 1 | 4 | 6 | 50% | 14% | **0.222** |
| **`4841`** | Dispute Code | 5 | 2 | 0 | 0 | 3 | 2 | 0% | 0% | **0** |
| **`13.3`** | Dispute Code | 6 | 4 | 1 | 0 | 2 | 3 | 100% | 25% | **0.4** |
| **`RZP05`** | Dispute Code | 12 | 8 | 6 | 0 | 4 | 2 | 100% | 75% | **0.857** |
| **`13.2`** | Dispute Code | 12 | 1 | 0 | 1 | 10 | 1 | 0% | 0% | **0** |
| **`C28`** | Dispute Code | 9 | 5 | 3 | 0 | 4 | 2 | 100% | 60% | **0.75** |
| **`RZP01`** | Dispute Code | 8 | 6 | 2 | 0 | 2 | 4 | 100% | 33% | **0.5** |
| **`RZP00`** | Dispute Code | 9 | 7 | 4 | 0 | 2 | 3 | 100% | 57% | **0.727** |
| **`RZP04`** | Dispute Code | 8 | 6 | 4 | 0 | 2 | 2 | 100% | 67% | **0.8** |
| **`C02`** | Dispute Code | 11 | 8 | 3 | 0 | 3 | 5 | 100% | 38% | **0.545** |
| **`13.1`** | Dispute Code | 7 | 4 | 3 | 0 | 3 | 1 | 100% | 75% | **0.857** |
| **`RZP06`** | Dispute Code | 13 | 7 | 4 | 0 | 6 | 3 | 100% | 57% | **0.727** |

---

## 7. Defense-Only Verification Summary

- **Pure Deterministic Function**: Win probability scoring is 100% mathematical rules + weights.
- **Zero LLM in Decision Gating**: Claude is strictly bounded to natural language drafting and is NEVER consulted for risk scoring.
- **Fixed Held-Out Split**: Guaranteed by SHA256 checksum in `data/split_manifest.json`.
