# Hackathon Strategy Document

## Core Objective
Build a hyper-transparent, user-friendly, and highly explainable banking dashboard tailored for the Indian market ("Bharat"). It must demonstrate deep technical capabilities while maintaining a focus on user trust and financial wellness.

## Key Differentiators for the Hackathon
1. **Explainable AI & ML**:
   - Instead of a black-box model, we built a transparent logistic regression model for risk scoring.
   - **Feature**: `RiskExplainabilityModal` allows users to see exact coefficients (e.g., how Savings Rate vs. Income Volatility impacts the decision).
   - **Feature**: `ModelTrainer` provides an interactive UI to retrain the risk model in real-time by uploading synthetic CSV datasets, showcasing an end-to-end ML pipeline.

2. **Proactive Fraud & Risk Mitigation**:
   - **Feature**: Real-time fraud anomaly detection that instantly triggers a toast notification on the dashboard when high-value or burst transactions occur.

3. **Interactive Decision Sandbox**:
   - **Feature**: `WhatIfSimulator` allows judges/users to tweak customer signals (like income or spending) and instantly see how the recommendation engine reacts, demonstrating the robustness of our deterministic and ML-assisted pipeline.

4. **Wellness-First Architecture**:
   - The system suppresses credit offers and instead provides support when high financial stress is detected, proving our commitment to responsible banking.

## Execution Timeline (Current Phase)
- ✅ Implemented Multilingual Chat Widget (en, hi, es, fr)
- ✅ Implemented Consent, Anomalies, Recommendations, and Audit Trails
- ✅ Deployed Custom ML Model Training & Explainability UI
- ✅ Added Fraud Toast & What-If Sandbox
- 🔄 Final polish, UI adjustments, and presentation prep.
