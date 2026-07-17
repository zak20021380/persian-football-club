import type { Types } from 'mongoose';

export interface SquadPosition { role: string; x: number; y: number }

const MIN_SLOT_X_GAP = 18;
const MIN_SLOT_Y_GAP = 15;

export function validateSquadPositions(positions: SquadPosition[], { allowOverlap = false }: { allowOverlap?: boolean } = {}): string|null {
  if (positions.length !== 11) return 'آرایش باید دقیقاً ۱۱ جایگاه داشته باشد.';
  for (const position of positions) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 5 || position.x > 95 || position.y < 5 || position.y > 95) {
      return 'همه جایگاه‌ها باید داخل محدوده زمین باشند.';
    }
  }
  if (allowOverlap) return null;
  for (let first = 0; first < positions.length; first += 1) {
    for (let second = first + 1; second < positions.length; second += 1) {
      const dx = Math.abs(positions[first].x - positions[second].x);
      const dy = Math.abs(positions[first].y - positions[second].y);
      if (dx < MIN_SLOT_X_GAP && dy < MIN_SLOT_Y_GAP) return 'فاصله جایگاه‌ها کافی نیست؛ بازیکن‌ها نباید روی هم قرار بگیرند.';
    }
  }
  return null;
}

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
