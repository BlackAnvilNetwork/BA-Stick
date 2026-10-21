/**
 * Specs for the Phase 0 load harness. Each bot is one play-bot.ts process.
 */

const JOBS = ["sorcerer", "cleric", "rogue", "fighter", "knight"] as const;

export type LoadBotSpec = {
  id: string;
  job: (typeof JOBS)[number];
};

export function buildLoadFleet(count: number): LoadBotSpec[] {
  if (!Number.isInteger(count) || count < 1 || count > 64) {
    throw new Error("--bots must be an integer from 1 to 64");
  }
  const specs: LoadBotSpec[] = [];
  for (let i = 0; i < count; i++) {
    const job = JOBS[i % JOBS.length]!;
    specs.push({ id: "load-" + String(i + 1) + "-" + job, job });
  }
  return specs;
}
