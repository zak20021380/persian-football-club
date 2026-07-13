import { describe, expect, it } from 'vitest';
import { AppError } from '../utils/errors.js';
import { createSignedInitDataForTest, validateTelegramInitData } from '../services/telegramAuth.js';
const token='123456:TEST_BOT_TOKEN_FOR_HMAC';
describe('Telegram initData validation',()=>{
  it('accepts a correctly signed payload',()=>{const data=createSignedInitDataForTest({id:42,first_name:'علی',username:'ali'},token);expect(validateTelegramInitData(data,token).user.id).toBe(42)});
  it('rejects missing initData',()=>expect(()=>validateTelegramInitData('',token)).toThrow(/ارسال نشده/));
  it('rejects tampering',()=>{const data=createSignedInitDataForTest({id:42,first_name:'علی'},token).replace('%D8%B9%D9%84%DB%8C','HACK');expect(()=>validateTelegramInitData(data,token)).toThrow(AppError)});
  it('rejects expired data',()=>{const data=createSignedInitDataForTest({id:42,first_name:'علی'},token,Math.floor(Date.now()/1000)-90_000);expect(()=>validateTelegramInitData(data,token)).toThrow(/منقضی/)});
  it('keeps different Telegram accounts separate',()=>{const first=validateTelegramInitData(createSignedInitDataForTest({id:42,first_name:'علی'},token),token);const second=validateTelegramInitData(createSignedInitDataForTest({id:43,first_name:'رضا'},token),token);expect(first.user.id).not.toBe(second.user.id)});
});
