export function isPredictionOpen(match: { status: string; predictionDeadline: Date; kickoffAt: Date }, now = new Date()): boolean {
  return match.status === 'scheduled' && match.predictionDeadline > now && match.kickoffAt > now;
}
