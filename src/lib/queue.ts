export const BUFFER_MINUTES = 5;

export type QueueToken = {
  id: string;
  token_number: number;
  status: "booked" | "arrived" | "served" | "no_show";
  commodity_id: string;
  farmer_id: string;
  centre_id: string;
  quantity: number;
};

/** Tokens still waiting or being served, in queue order. */
export function activeQueue<T extends { status: string; token_number: number }>(tokens: T[]): T[] {
  return tokens
    .filter((t) => t.status === "booked" || t.status === "arrived")
    .sort((a, b) => a.token_number - b.token_number);
}

/** 1-based position of a token in the active queue; 0 means not waiting. */
export function positionOf(tokens: QueueToken[], tokenId: string): number {
  const queue = activeQueue(tokens);
  const idx = queue.findIndex((t) => t.id === tokenId);
  return idx === -1 ? 0 : idx + 1;
}

/**
 * Human-readable wait estimate.
 * wait = average service time for the commodity x (people ahead of you) + buffer
 */
export function estimateWait(avgServiceMinutes: number, position: number) {
  const ahead = Math.max(position - 1, 0);
  const minutes = avgServiceMinutes * ahead + BUFFER_MINUTES;
  return {
    ahead,
    minutes,
    formula: `${avgServiceMinutes} min per farmer × ${ahead} ahead of you + ${BUFFER_MINUTES} min buffer = ${minutes} min`,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
