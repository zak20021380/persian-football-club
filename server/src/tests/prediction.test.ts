import { describe, expect, it } from 'vitest';
import { isPredictionOpen } from '../services/prediction.js';
const now=new Date('2026-07-12T10:00:00Z');
describe('prediction deadline',()=>{it('is open before both deadline and kickoff',()=>expect(isPredictionOpen({status:'scheduled',predictionDeadline:new Date('2026-07-12T11:00:00Z'),kickoffAt:new Date('2026-07-12T12:00:00Z')},now)).toBe(true));it('closes at deadline',()=>expect(isPredictionOpen({status:'scheduled',predictionDeadline:now,kickoffAt:new Date('2026-07-12T12:00:00Z')},now)).toBe(false));it('closes non-scheduled matches',()=>expect(isPredictionOpen({status:'live',predictionDeadline:new Date('2026-07-12T11:00:00Z'),kickoffAt:new Date('2026-07-12T12:00:00Z')},now)).toBe(false))});
