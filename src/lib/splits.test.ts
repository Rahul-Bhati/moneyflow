import { describe, it, expect } from "vitest";
import { equalSplit, summarizeBalances, balancePhrase } from "./splits";
import type { Balance } from "./types";

const sum = (shares: { share_amount: number }[]) =>
  Math.round(shares.reduce((s, p) => s + p.share_amount, 0) * 100) / 100;

describe("equalSplit", () => {
  it("splits a clean amount evenly", () => {
    const r = equalSplit(45, ["a", "b", "c"]);
    expect(r).toEqual([
      { user_id: "a", share_amount: 15 },
      { user_id: "b", share_amount: 15 },
      { user_id: "c", share_amount: 15 },
    ]);
  });

  it("allocates the rounding remainder so shares always sum to the total", () => {
    const r = equalSplit(100, ["a", "b", "c"]);
    // 100/3 = 33.33…; first member absorbs the extra paisa.
    expect(r.map((p) => p.share_amount)).toEqual([33.34, 33.33, 33.33]);
    expect(sum(r)).toBe(100);
  });

  it("never loses or gains money across odd splits", () => {
    for (const amount of [10, 0.01, 99.99, 1, 7, 1000.01]) {
      for (const n of [1, 2, 3, 4, 5, 7]) {
        const ids = Array.from({ length: n }, (_, i) => `u${i}`);
        expect(sum(equalSplit(amount, ids))).toBe(
          Math.round(amount * 100) / 100
        );
      }
    }
  });

  it("returns nothing for zero members", () => {
    expect(equalSplit(50, [])).toEqual([]);
  });

  it("handles a single member taking the whole amount", () => {
    expect(equalSplit(45, ["a"])).toEqual([{ user_id: "a", share_amount: 45 }]);
  });
});

describe("summarizeBalances", () => {
  it("is settled when there are no balances", () => {
    const s = summarizeBalances([]);
    expect(s.settled).toBe(true);
    expect(s.toReceive).toBe(0);
    expect(s.toPay).toBe(0);
    expect(s.net).toBe(0);
  });

  it("splits positive and negative nets into receive/pay", () => {
    // Worked example: Nikhil owes me 15 (+15), I owe Devansh 5 (-5).
    const balances: Balance[] = [
      { counterparty: "nikhil", net: 15 },
      { counterparty: "devansh", net: -5 },
    ];
    const s = summarizeBalances(balances);
    expect(s.toReceive).toBe(15);
    expect(s.toPay).toBe(5);
    expect(s.net).toBe(10);
    expect(s.settled).toBe(false);
  });

  it("rounds totals to two decimals", () => {
    const s = summarizeBalances([
      { counterparty: "a", net: 10.005 },
      { counterparty: "b", net: 0.001 },
    ]);
    expect(s.toReceive).toBe(10.01);
  });
});

describe("balancePhrase", () => {
  it("avoids owe/borrow wording", () => {
    expect(balancePhrase(15, "Devansh")).toBe("Devansh will pay you");
    expect(balancePhrase(-5, "Devansh")).toBe("You'll pay Devansh");
    expect(balancePhrase(0, "Devansh")).toBe("Settled with Devansh");
  });
});
