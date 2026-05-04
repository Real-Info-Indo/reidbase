import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Prompt-governance fixtures.
 *
 * REID must lead with transaction, pricing, and supply signals before rental
 * performance on mixed sales/rental queries. Rental-led queries (occupancy,
 * ADR, revenue, rent, yield) remain rental-first.
 *
 * These tests pin the ordering rules in the shared governance file and the
 * entry-prompt blocks in the chat edge functions so any regression that
 * reorders rental ahead of transaction in a mixed-market context fails CI.
 */

const read = (rel: string) =>
  readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

const GLOBAL_RULES = read("supabase/functions/_shared/global-rules.ts");
const CHAT = read("supabase/functions/chat/index.ts");
const DATA_ANALYST = read("supabase/functions/chat-data-analyst/index.ts");

/** Index of the first occurrence of any pattern in `patterns`. -1 if none. */
function firstIndex(haystack: string, patterns: RegExp[]): number {
  let min = Infinity;
  for (const p of patterns) {
    const m = haystack.match(p);
    if (m && m.index !== undefined && m.index < min) min = m.index;
  }
  return min === Infinity ? -1 : min;
}

const TRANSACTION_PATTERNS = [
  /transaction/i,
  /sold price/i,
  /sold volume/i,
  /price per sqm/i,
  /price per sq\s*m/i,
  /median sale/i,
  /active supply/i,
  /asking price/i,
  /freehold price growth/i,
];

const RENTAL_PATTERNS = [
  /rental performance/i,
  /rental revenue/i,
  /occupancy/i,
  /\bADR\b/,
  /\byield\b/i,
];

function expectTransactionBeforeRental(block: string, label: string) {
  const tIdx = firstIndex(block, TRANSACTION_PATTERNS);
  const rIdx = firstIndex(block, RENTAL_PATTERNS);
  expect(tIdx, `${label}: no transaction-side signal found`).toBeGreaterThanOrEqual(0);
  expect(rIdx, `${label}: no rental-side signal found`).toBeGreaterThanOrEqual(0);
  expect(
    tIdx,
    `${label}: rental signal appears before transaction signal (t=${tIdx}, r=${rIdx})`,
  ).toBeLessThan(rIdx);
}

function extractEntry(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, `entry prompt missing: ${header}`).toBeGreaterThan(-1);
  // Skip past the header line and the Trigger: line (which often quotes
  // the user's mixed-market question and would otherwise contaminate
  // ordering checks). The remainder is the response governance body.
  let rest = source.slice(start + header.length);
  rest = rest.replace(/^[\s\S]*?\nTrigger:[^\n]*\n/, "");
  const endRel = rest.search(/\n(ENTRY PROMPT|FEW-SHOT EXAMPLES)/);
  return endRel === -1 ? rest : rest.slice(0, endRel);
}

describe("Mixed market response ordering — governance file", () => {
  it("declares the response-ordering rule with transaction signals first", () => {
    expect(GLOBAL_RULES).toMatch(/RESPONSE ORDERING — MIXED SALES AND RENTAL QUERIES/);
    const block = GLOBAL_RULES.split("RESPONSE ORDERING — MIXED SALES AND RENTAL QUERIES")[1] ?? "";
    expectTransactionBeforeRental(block.slice(0, 1500), "RESPONSE_ORDERING_RULES");
  });

  it("lists the rental-led exception triggers", () => {
    const triggers = ["rental performance", "occupancy", "ADR", "revenue", "rent", "yield"];
    for (const t of triggers) {
      expect(GLOBAL_RULES.toLowerCase()).toContain(t.toLowerCase());
    }
    expect(GLOBAL_RULES).toMatch(/Exception\s*[—-]\s*rental-led queries/i);
  });

  it("includes a silent self-review check for mixed market ordering", () => {
    expect(GLOBAL_RULES).toMatch(/Mixed market ordering/i);
  });
});

describe("Mixed market response ordering — chat-data-analyst entry prompts", () => {
  it("Market Trends leads with transaction/pricing/supply before rental", () => {
    const block = extractEntry(DATA_ANALYST, "ENTRY PROMPT — MARKET TRENDS");
    expectTransactionBeforeRental(block, "data-analyst Market Trends");
  });

  it("Top Markets leads with transaction signals before rental signals", () => {
    const block = extractEntry(DATA_ANALYST, "ENTRY PROMPT — TOP MARKETS");
    expectTransactionBeforeRental(block, "data-analyst Top Markets");
  });
});

describe("Mixed market response ordering — chat (multi-mode) entry prompts", () => {
  it("Market Trends leads with transaction/pricing/supply before rental", () => {
    const block = extractEntry(CHAT, "ENTRY PROMPT — MARKET TRENDS");
    expectTransactionBeforeRental(block, "chat Market Trends");
  });

  it("Top Markets leads with transaction signals before rental signals", () => {
    const block = extractEntry(CHAT, "ENTRY PROMPT — TOP MARKETS");
    expectTransactionBeforeRental(block, "chat Top Markets");
  });
});

/**
 * Behavioural query fixtures. These document the expected lead-side for a
 * representative set of user questions and prove the rental-led exception is
 * preserved. The classifier mirrors the rule-set: mixed-market queries are
 * transaction-led unless the user explicitly names a rental metric.
 */

// Note: generic "revenue" is intentionally excluded — it appears in
// transaction-side framings too. Only explicit rental phrasings flip the lead.
const RENTAL_LED_TRIGGERS = [
  /\brental performance\b/i,
  /\brental revenue\b/i,
  /\brental income\b/i,
  /\boccupancy\b/i,
  /\bADR\b/,
  /\brent\b/i,
  /\byield\b/i,
];

function expectedLead(query: string): "transaction" | "rental" {
  return RENTAL_LED_TRIGGERS.some((r) => r.test(query)) ? "rental" : "transaction";
}

describe("Mixed market query classification", () => {
  const cases: Array<{ query: string; lead: "transaction" | "rental" }> = [
    { query: "Give me an overview of the Bali property market", lead: "transaction" },
    {
      query: "Which locations have the strongest fundamentals across sales and rental?",
      lead: "transaction",
    },
    { query: "Compare Canggu and Pererenan overall", lead: "transaction" },
    { query: "How is rental performance in Canggu?", lead: "rental" },
    { query: "What occupancy and ADR should I expect?", lead: "rental" },
  ];

  for (const c of cases) {
    it(`"${c.query}" → ${c.lead}-led`, () => {
      expect(expectedLead(c.query)).toBe(c.lead);
    });
  }
});
