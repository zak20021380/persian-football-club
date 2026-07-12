import type { BuiltInSquadFormation } from '@/types/api';

export interface FormationSlot { role: string; x: number; y: number; }

export const formations: Record<BuiltInSquadFormation, FormationSlot[]> = {
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
  '3-5-2': [
    { role: 'GK', x: 50, y: 91 },
    { role: 'CB', x: 22, y: 74 }, { role: 'CB', x: 50, y: 75 }, { role: 'CB', x: 78, y: 74 },
    { role: 'LM', x: 10, y: 48 }, { role: 'CM', x: 30, y: 54 }, { role: 'DM', x: 50, y: 60 }, { role: 'CM', x: 70, y: 54 }, { role: 'RM', x: 90, y: 48 },
    { role: 'ST', x: 35, y: 20 }, { role: 'ST', x: 65, y: 20 },
  ],
  '3-4-3': [
    { role: 'GK', x: 50, y: 91 },
    { role: 'CB', x: 22, y: 74 }, { role: 'CB', x: 50, y: 76 }, { role: 'CB', x: 78, y: 74 },
    { role: 'LM', x: 13, y: 50 }, { role: 'CM', x: 38, y: 56 }, { role: 'CM', x: 62, y: 56 }, { role: 'RM', x: 87, y: 50 },
    { role: 'LW', x: 17, y: 24 }, { role: 'ST', x: 50, y: 16 }, { role: 'RW', x: 83, y: 24 },
  ],
  '5-3-2': [
    { role: 'GK', x: 50, y: 91 },
    { role: 'LWB', x: 9, y: 68 }, { role: 'CB', x: 28, y: 74 }, { role: 'CB', x: 50, y: 76 }, { role: 'CB', x: 72, y: 74 }, { role: 'RWB', x: 91, y: 68 },
    { role: 'CM', x: 20, y: 48 }, { role: 'DM', x: 50, y: 57 }, { role: 'CM', x: 80, y: 48 },
    { role: 'ST', x: 35, y: 20 }, { role: 'ST', x: 65, y: 20 },
  ],
  '4-1-4-1': [
    { role: 'GK', x: 50, y: 91 },
    { role: 'LB', x: 12, y: 73 }, { role: 'CB', x: 37, y: 76 }, { role: 'CB', x: 63, y: 76 }, { role: 'RB', x: 88, y: 73 },
    { role: 'DM', x: 50, y: 61 },
    { role: 'LM', x: 12, y: 42 }, { role: 'CM', x: 37, y: 45 }, { role: 'CM', x: 63, y: 45 }, { role: 'RM', x: 88, y: 42 },
    { role: 'ST', x: 50, y: 16 },
  ],
};
