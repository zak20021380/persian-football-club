import type { Types } from 'mongoose';

export function reassignSquadSlot(
  starters: Array<Types.ObjectId|null>,
  substitutes: Types.ObjectId[],
  slotIndex: number,
  nextPlayerId: Types.ObjectId|null,
): { starters: Array<Types.ObjectId|null>; substitutes: Types.ObjectId[] } {
  const nextStarters = Array.from({ length: 11 }, (_, index) => starters[index] ?? null);
  const displacedId = nextStarters[slotIndex];
  nextStarters[slotIndex] = nextPlayerId;
  const nextSubstitutes = substitutes.filter(id => String(id) !== String(nextPlayerId) && String(id) !== String(displacedId));
  if (displacedId && String(displacedId) !== String(nextPlayerId)) nextSubstitutes.push(displacedId);
  return { starters: nextStarters, substitutes: nextSubstitutes };
}
