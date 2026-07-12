import type { SquadFormation } from '@/types/api';

export interface FormationSlot { role: string; x: number; y: number; }

export const formations: Record<SquadFormation, FormationSlot[]> = {
  '4-3-3': [
    { role: 'GK', x: 50, y: 91 },
    { role: 'LB', x: 13, y: 73 }, { role: 'CB', x: 38, y: 76 }, { role: 'CB', x: 62, y: 76 }, { role: 'RB', x: 87, y: 73 },
    { role: 'CM', x: 19, y: 51 }, { role: 'CM', x: 50, y: 57 }, { role: 'CM', x: 81, y: 51 },
    { role: 'LW', x: 17, y: 25 }, { role: 'ST', x: 50, y: 16 }, { role: 'RW', x: 83, y: 25 },
  ],
  '4-4-2': [
    { role: 'GK', x: 50, y: 91 },
    { role: 'LB', x: 13, y: 73 }, { role: 'CB', x: 38, y: 76 }, { role: 'CB', x: 62, y: 76 }, { role: 'RB', x: 87, y: 73 },
    { role: 'LM', x: 13, y: 49 }, { role: 'CM', x: 38, y: 53 }, { role: 'CM', x: 62, y: 53 }, { role: 'RM', x: 87, y: 49 },
    { role: 'ST', x: 35, y: 21 }, { role: 'ST', x: 65, y: 21 },
  ],
  '4-2-3-1': [
    { role: 'GK', x: 50, y: 91 },
    { role: 'LB', x: 13, y: 73 }, { role: 'CB', x: 38, y: 76 }, { role: 'CB', x: 62, y: 76 }, { role: 'RB', x: 87, y: 73 },
    { role: 'DM', x: 35, y: 58 }, { role: 'DM', x: 65, y: 58 },
    { role: 'LW', x: 16, y: 37 }, { role: 'AM', x: 50, y: 40 }, { role: 'RW', x: 84, y: 37 },
    { role: 'ST', x: 50, y: 16 },
  ],
};
