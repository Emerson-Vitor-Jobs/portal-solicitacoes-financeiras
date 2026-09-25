export type LoginLocationState = { expired?: boolean; from?: string };

export function readLoginState(state: unknown): LoginLocationState {
  if (typeof state !== 'object' || state === null) return {};
  const candidate = state as Record<string, unknown>;
  return {
    ...(candidate.expired === true ? { expired: true } : {}),
    ...(typeof candidate.from === 'string' ? { from: candidate.from } : {}),
  };
}
