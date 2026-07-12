import { describe, expect, it } from 'vitest';
import { isAcceptedMember } from '../services/membership.js';
describe('forced membership',()=>{it.each([['creator',true],['administrator',true],['member',true],['left',false],['kicked',false]] as const)('%s maps to %s',(status,expected)=>expect(isAcceptedMember(status)).toBe(expected));it('accepts restricted users only when is_member is true',()=>{expect(isAcceptedMember('restricted',true)).toBe(true);expect(isAcceptedMember('restricted',false)).toBe(false)})});
