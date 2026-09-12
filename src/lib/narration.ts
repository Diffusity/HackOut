import { Recommendation, Signals, TimingSignals } from "./types";

/**
 * Deterministic narration layer (ADR-024).
 *
 * Two jobs:
 * 1. **The demo never dies.** Gemini's free tier is ~20 requests/day; a single
 *    orchestrator run can exhaust it. Every LLM path degrades to these
 *    templates, which are grounded in the same reason trace, so a quota-dead
 *    key costs us polish, never correctness.
 * 2. **Channel independence (Bharat Mode).** The same decision renders as an
 *    app card, a 160-character SMS, or an IVR script — proving the decision
 *    layer is channel-agnostic for feature-phone users in Tier 3/4 towns.
 */

export type Lang = "en" | "hi";

interface ProductCopy {
  name: Record<Lang, string>;
  benefit: Record<Lang, string>;
  /** Short enough to survive a 160-character SMS */
  sms: Record<Lang, string>;
}

export const PRODUCT_COPY: Record<string, ProductCopy> = {
  RD: {
    name: { en: "Recurring Deposit", hi: "आवर्ती जमा (RD)" },
    benefit: {
      en: "a fixed amount set aside every month, with guaranteed interest and no market risk",
      hi: "हर महीने एक तय रकम, गारंटीड ब्याज के साथ और बाज़ार का कोई जोखिम नहीं",
    },
    sms: { en: "a Recurring Deposit", hi: "RD (आवर्ती जमा)" },
  },
  SIP: {
    name: { en: "Systematic Investment Plan", hi: "एसआईपी (SIP)" },
    benefit: {
      en: "small monthly investments that build long-term wealth",
      hi: "हर महीने थोड़ा निवेश जो लंबे समय में बड़ी पूंजी बनाता है",
    },
    sms: { en: "an SIP", hi: "SIP" },
  },
  FD: {
    name: { en: "Fixed Deposit", hi: "सावधि जमा (FD)" },
    benefit: {
      en: "a lump sum parked safely at a higher rate of interest",
      hi: "एकमुश्त रकम सुरक्षित रूप से ऊँची ब्याज दर पर",
    },
    sms: { en: "a Fixed Deposit", hi: "FD" },
  },
  CREDIT_CARD: {
    name: { en: "Credit Card", hi: "क्रेडिट कार्ड" },
    benefit: {
      en: "a flexible credit line for everyday purchases",
      hi: "रोज़मर्रा की ख़रीद के लिए एक लचीली क्रेडिट सीमा",
    },
    sms: { en: "a Credit Card", hi: "क्रेडिट कार्ड" },
  },
  PERSONAL_LOAN: {
    name: { en: "Personal Loan", hi: "व्यक्तिगत ऋण" },
    benefit: {
      en: "funds for a planned need, repaid in fixed monthly instalments",
      hi: "ज़रूरत के लिए रकम, जो तय मासिक किस्तों में चुकाई जाती है",
    },
    sms: { en: "a Personal Loan", hi: "पर्सनल लोन" },
  },
  VEHICLE_LOAN: {
    name: { en: "Vehicle Loan", hi: "वाहन ऋण" },
    benefit: {
      en: "financing sized for irregular income, so instalments follow your earnings",
      hi: "अनियमित आमदनी के हिसाब से बनी किस्तें",
    },
    sms: { en: "a Vehicle Loan", hi: "व्हीकल लोन" },
  },
  HOME_LOAN: {
    name: { en: "Home Loan", hi: "गृह ऋण" },
    benefit: {
      en: "long-term secured credit at the lowest rate you qualify for",
      hi: "लंबी अवधि का सुरक्षित ऋण, सबसे कम दर पर",
    },
    sms: { en: "a Home Loan", hi: "होम लोन" },
  },
  HEALTH_INSURANCE: {
    name: { en: "Health Insurance", hi: "स्वास्थ्य बीमा" },
    benefit: {
      en: "protection for your family against a sudden medical bill",
      hi: "अचानक आने वाले मेडिकल ख़र्च से परिवार की सुरक्षा",
    },
    sms: { en: "Health Insurance", hi: "हेल्थ इंश्योरेंस" },
  },
  EMI_RESTRUCTURE: {
    name: { en: "EMI Restructuring", hi: "ईएमआई पुनर्गठन" },
    benefit: {
      en: "a smaller monthly instalment over a longer period, with no penalty",
      hi: "लंबी अवधि में छोटी मासिक किस्त, बिना किसी जुर्माने के",
    },
    sms: { en: "EMI relief", hi: "EMI राहत" },
  },
  NONE: {
    name: { en: "No recommendation", hi: "कोई सुझाव नहीं" },
    benefit: { en: "no product is being offered right now", hi: "अभी कोई उत्पाद नहीं दिया जा रहा" },
    sms: { en: "no offer", hi: "कोई ऑफ़र नहीं" },
  },
};

export function productName(id: string, lang: Lang = "en"): string {
  return PRODUCT_COPY[id]?.name[lang] ?? id;
}

export interface NarrationInput {
  recommendation: Recommendation;
  signals: Signals | null;
  timing?: TimingSignals | null;
  wellnessScore?: number | null;
  lang?: Lang;
}

/**
 * Plain-language explanation built ONLY from deterministic facts. Every
 * sentence maps to a value that appears in the reason trace, so the fallback
 * is held to exactly the grounding standard the LLM output is (ADR-021).
 */
export function buildNarration(input: NarrationInput): string {
  const { recommendation: rec, signals, timing, wellnessScore } = input;
  const lang: Lang = input.lang ?? "en";
  const copy = PRODUCT_COPY[rec.product] ?? PRODUCT_COPY.NONE;
  const suppressed = rec.wellnessGateStatus === "suppressed";

  const parts: string[] = [];

  if (lang === "hi") {
    if (suppressed) {
      parts.push(
        `आपके हाल के लेन-देन बता रहे हैं कि इस समय पैसों का दबाव है, इसलिए हमने कोई नया ऑफ़र नहीं दिखाया।`,
        `उसकी जगह हम ${copy.name.hi} सुझा रहे हैं — ${copy.benefit.hi}।`
      );
    } else {
      parts.push(`आपके लिए सुझाव: ${copy.name.hi} — ${copy.benefit.hi}।`);
    }
    if (signals) {
      parts.push(
        `यह सुझाव आपके पिछले महीनों के लेन-देन पर आधारित है: मासिक आमदनी लगभग ₹${signals.monthlyIncome.toLocaleString("en-IN")}, ` +
          `मासिक ख़र्च लगभग ₹${signals.monthlyExpense.toLocaleString("en-IN")}, और बचत दर ${Math.round(signals.savingsRate * 100)}%।`
      );
    }
    if (timing?.trigger) parts.push(`समय: ${timing.reason}`);
    if (typeof wellnessScore === "number") {
      parts.push(`आपका वित्तीय स्वास्थ्य स्कोर ${wellnessScore}/100 है।`);
    }
    parts.push(`यह फ़ैसला नियमों से लिया गया है और इसका पूरा कारण रिकॉर्ड में दर्ज है।`);
    return parts.join(" ");
  }

  if (suppressed) {
    parts.push(
      `Your recent transactions suggest money is tight right now, so we have paused the offer you would normally see.`,
      `Instead we are suggesting ${copy.name.en} — ${copy.benefit.en}.`
    );
  } else {
    parts.push(`We are suggesting ${copy.name.en} — ${copy.benefit.en}.`);
  }

  if (signals) {
    parts.push(
      `This comes from your own transaction history: about ₹${signals.monthlyIncome.toLocaleString("en-IN")} coming in each month, ` +
        `about ₹${signals.monthlyExpense.toLocaleString("en-IN")} going out, and a savings rate of ${Math.round(signals.savingsRate * 100)}%.`
    );
    if (signals.emiMissCount90d > 0) {
      parts.push(
        `We also noticed ${signals.emiMissCount90d} missed EMI ${signals.emiMissCount90d === 1 ? "payment" : "payments"} in the last 90 days.`
      );
    }
  }

  if (timing?.trigger) parts.push(`On timing: ${timing.reason}`);
  if (typeof wellnessScore === "number") {
    parts.push(`Your financial wellness score is ${wellnessScore} out of 100.`);
  }
  parts.push(`Every reason behind this decision is recorded and can be inspected.`);

  return parts.join(" ");
}

/** 160-character SMS rendering for feature-phone customers (Bharat Mode). */
export function buildSms(input: NarrationInput): string {
  const { recommendation: rec, signals } = input;
  const lang: Lang = input.lang ?? "en";
  const copy = PRODUCT_COPY[rec.product] ?? PRODUCT_COPY.NONE;
  const suppressed = rec.wellnessGateStatus === "suppressed";
  const savings = signals ? `${Math.round(signals.savingsRate * 100)}%` : "-";

  const text =
    lang === "hi"
      ? suppressed
        ? `DhanSathi: इस माह खर्च ज़्यादा दिखा. कोई नया ऑफ़र नहीं. ${copy.sms.hi} के लिए 1 दबाएँ. मदद: 1800-XXX.`
        : `DhanSathi: बचत दर ${savings}. आपके लिए ${copy.sms.hi} सही रहेगा. जानकारी हेतु 1 दबाएँ. रोकने हेतु STOP.`
      : suppressed
        ? `DhanSathi: money looks tight this month, so no new offer. ${copy.sms.en} is available. Reply 1 for help.`
        : `DhanSathi: savings rate ${savings}. ${copy.sms.en} suits you. Reply 1 to know more, STOP to opt out.`;

  return text.length <= 160 ? text : `${text.slice(0, 157)}...`;
}

/** IVR / missed-call callback script — no smartphone or data needed. */
export function buildIvr(input: NarrationInput): string[] {
  const { recommendation: rec, signals } = input;
  const lang: Lang = input.lang ?? "en";
  const copy = PRODUCT_COPY[rec.product] ?? PRODUCT_COPY.NONE;
  const suppressed = rec.wellnessGateStatus === "suppressed";

  if (lang === "hi") {
    return [
      `नमस्ते, यह धनसाथी की ओर से कॉल है।`,
      suppressed
        ? `हमने देखा कि इस महीने ख़र्च ज़्यादा रहा, इसलिए हम कोई नया उत्पाद नहीं बेच रहे।`
        : `आपके खाते के आधार पर ${copy.name.hi} आपके लिए उपयुक्त है।`,
      signals ? `आपकी बचत दर ${Math.round(signals.savingsRate * 100)} प्रतिशत है।` : ``,
      `विस्तार से सुनने के लिए 1 दबाएँ। प्रतिनिधि से बात करने के लिए 2 दबाएँ।`,
    ].filter(Boolean);
  }

  return [
    `Namaste, this is a call from DhanSathi.`,
    suppressed
      ? `We noticed spending was high this month, so we are not selling you anything new today.`
      : `Based on your account, ${copy.name.en} suits you.`,
    signals ? `Your savings rate is ${Math.round(signals.savingsRate * 100)} percent.` : ``,
    `Press 1 to hear the reasons. Press 2 to speak to a representative.`,
  ].filter(Boolean);
}
