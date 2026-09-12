import assert from "assert";
import { redactPII } from "../src/lib/guardrails/piiRedaction";

function runTests() {
  console.log("Running PII Redaction Tests...\n");

  let passed = 0, failed = 0;

  const testCases = [
    {
      name: "PAN Card",
      input: "My PAN is ABCDE1234F",
      expected: "My PAN is [REDACTED PAN]",
      findings: ["PAN"]
    },
    {
      name: "Aadhaar Card",
      input: "Update my Aadhaar 1234 5678 9012 please.",
      expected: "Update my Aadhaar XXXXXXXXXX9012 please.",
      findings: ["Aadhaar"]
    },
    {
      name: "Phone Number",
      input: "Call me at +91 9876543210.",
      expected: "Call me at [REDACTED Phone].",
      findings: ["Phone"]
    },
    {
      name: "Email Address",
      input: "Send it to priya.test@example.com",
      expected: "Send it to [REDACTED Email]",
      findings: ["Email"]
    },
    {
      name: "Account Number (Masked)",
      input: "My account is 1234567890123",
      expected: "My account is XXXXXXXXX0123",
      findings: ["Account Number"]
    },
    {
      name: "Clean text",
      input: "What is my current EMI?",
      expected: "What is my current EMI?",
      findings: []
    }
  ];

  for (const tc of testCases) {
    try {
      const { redactedText, findings } = redactPII(tc.input);
      assert.strictEqual(redactedText, tc.expected, `Expected '${tc.expected}', got '${redactedText}'`);
      assert.deepStrictEqual(findings.sort(), tc.findings.sort(), `Expected findings [${tc.findings}], got [${findings}]`);
      console.log(`✅ ${tc.name}: Passed`);
      passed++;
    } catch (e: any) {
      console.error(`❌ ${tc.name} failed:`, e.message);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests();
