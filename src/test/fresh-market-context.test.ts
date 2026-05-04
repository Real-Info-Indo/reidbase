import { describe, it, expect, vi } from "vitest";

// We import the source TS directly. The classifier is plain JS-compatible.
// Note: the file uses Deno-style imports only inside buildFreshMarketContext;
// classifyFreshIntent has zero runtime deps so it imports cleanly under Vitest.
import {
  classifyFreshIntent,
  buildFreshMarketContext,
} from "../../supabase/functions/_shared/fresh-market-context";

describe("classifyFreshIntent", () => {
  it("classifies pre-loaded landing prompts", () => {
    expect(
      classifyFreshIntent(
        "Give me an overview of the current Bali property market, what are the key trends right now?",
      ),
    ).toBe("market_overview");
    expect(
      classifyFreshIntent(
        "Which locations are showing the strongest market fundamentals across sales and rental performance?",
      ),
    ).toBe("top_markets");
    expect(
      classifyFreshIntent("What does the data show about Bali's off-plan property market?"),
    ).toBe("off_plan");
    expect(
      classifyFreshIntent(
        "I'd like to estimate the yield on a property I'm looking at, how does this work?",
      ),
    ).toBe("yield_estimator");
  });

  it("classifies widget quick prompts", () => {
    expect(classifyFreshIntent("What are the latest property market trends in Bali?")).toBe(
      "market_overview",
    );
    expect(classifyFreshIntent("Give me an overview of the current Bali property market")).toBe(
      "market_overview",
    );
    expect(classifyFreshIntent("What are the current yield figures across Bali locations?")).toBe(
      "yield_estimator",
    );
  });

  it("classifies semantically equivalent current-market questions", () => {
    expect(classifyFreshIntent("How is the Bali market doing right now?")).toBe("market_overview");
    expect(classifyFreshIntent("What's the latest trend in the property market?")).toBe(
      "market_overview",
    );
    expect(classifyFreshIntent("What does current off-plan supply look like?")).toBe("off_plan");
    expect(classifyFreshIntent("Walk me through the yield estimator")).toBe("yield_estimator");
  });

  it("returns 'none' for generic non-current questions (uses normal RAG)", () => {
    expect(classifyFreshIntent("What's the history of the Canggu market?")).toBe("none");
    expect(classifyFreshIntent("Tell me about leasehold depreciation")).toBe("none");
    expect(classifyFreshIntent("Hello")).toBe("none");
    expect(classifyFreshIntent("Compare Berawa and Pererenan medians")).toBe("none");
  });
});

describe("buildFreshMarketContext", () => {
  const fakeSupabase = (rows: unknown[] = [{ ok: 1 }]) => ({
    rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
  });

  it("returns empty block when intent is none", async () => {
    const { intent, block } = await buildFreshMarketContext(
      fakeSupabase() as never,
      "what's leasehold depreciation?",
      "free",
    );
    expect(intent).toBe("none");
    expect(block).toBe("");
  });

  it("market_overview lists transaction-side metrics before rental-side", async () => {
    const { intent, block } = await buildFreshMarketContext(
      fakeSupabase() as never,
      "Give me an overview of the current Bali property market",
      "free",
    );
    expect(intent).toBe("market_overview");
    const txnIdx = block.indexOf("[Transaction]");
    const rentIdx = block.indexOf("[Rental]");
    expect(txnIdx).toBeGreaterThan(-1);
    expect(rentIdx).toBeGreaterThan(txnIdx);
  });

  it("Free tier top_markets context includes the no-location-level note", async () => {
    const { block } = await buildFreshMarketContext(
      fakeSupabase() as never,
      "Which locations are showing the strongest market fundamentals across sales and rental performance?",
      "free",
    );
    expect(block).toMatch(/caller is Free/i);
    expect(block).toMatch(/neighbourhood-level/i);
  });

  it("Member tier top_markets context omits the Free-tier restriction note", async () => {
    const { block } = await buildFreshMarketContext(
      fakeSupabase() as never,
      "Which locations are showing the strongest market fundamentals across sales and rental performance?",
      "member",
    );
    expect(block).not.toMatch(/caller is Free/i);
  });

  it("off_plan context queries off-plan supply tables", async () => {
    const sb = fakeSupabase();
    const { block } = await buildFreshMarketContext(
      sb as never,
      "What does the data show about Bali's off-plan property market?",
      "member",
    );
    expect(block).toMatch(/off-plan/i);
    expect(sb.rpc).toHaveBeenCalled();
  });

  it("yield_estimator context provides ADR/occupancy benchmarks", async () => {
    const { block } = await buildFreshMarketContext(
      fakeSupabase() as never,
      "What are the current yield figures across Bali locations?",
      "member",
    );
    expect(block).toMatch(/Yield benchmark/);
    expect(block).toMatch(/ADR \+ occupancy/);
  });
});
