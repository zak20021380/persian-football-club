import { describe, expect, it } from 'vitest';
import { canCreateReferral } from '../services/referral.js';
describe('referrals',()=>{it('prevents self referral',()=>expect(canCreateReferral(10,10,true)).toBe(false));it('counts only new users',()=>expect(canCreateReferral(10,11,false)).toBe(false));it('allows a different new user',()=>expect(canCreateReferral(10,11,true)).toBe(true))});
