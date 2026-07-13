import { describe, expect, it, vi } from 'vitest';
import {
  availableMatchReminderMinutes,
  buildMatchReminderMessage,
  isTelegramForbidden,
  matchReminderButton,
  matchReminderSendAt,
  planMatchReminder,
  sendMatchReminderMessage
} from '../services/reminders.js';

const kickoffAt = new Date('2026-07-13T17:00:00.000Z');
const match = {
  _id: 'match-1',
  homeTeam: 'پرسپولیس',
  awayTeam: 'استقلال',
  competitionName: 'لیگ برتر ایران',
  kickoffAt,
  status: 'scheduled' as const,
  published: true
};

describe('match reminders', () => {
  it.each([[15, '2026-07-13T16:45:00.000Z'], [30, '2026-07-13T16:30:00.000Z'], [60, '2026-07-13T16:00:00.000Z']] as const)(
    'activates %i minutes before kickoff',
    (minutes, expected) => expect(matchReminderSendAt(kickoffAt, minutes).toISOString()).toBe(expected)
  );

  it('only offers reminder times that have not passed', () => {
    expect(availableMatchReminderMinutes(kickoffAt, new Date('2026-07-13T16:20:00.000Z'))).toEqual([15, 30]);
  });

  it('reschedules when the match time changes', () => {
    const changed = { ...match, kickoffAt: new Date('2026-07-13T18:30:00.000Z') };
    expect(planMatchReminder(changed, 30, new Date('2026-07-13T16:00:00.000Z'))).toEqual({ action: 'wait', sendAt: new Date('2026-07-13T18:00:00.000Z') });
  });

  it('cancels reminders for cancelled and already-started matches', () => {
    expect(planMatchReminder({ ...match, status: 'cancelled' }, 30, new Date('2026-07-13T16:00:00.000Z'))).toMatchObject({ action: 'cancel', reason: 'MATCH_CANCELLED' });
    expect(planMatchReminder(match, 30, kickoffAt)).toMatchObject({ action: 'cancel', reason: 'MATCH_STARTED' });
  });

  it('sends immediately when a moved kickoff makes the selected lead time due', () => {
    const now = new Date('2026-07-13T16:40:00.000Z');
    expect(planMatchReminder(match, 30, now)).toEqual({ action: 'send', sendAt: now });
  });

  it('builds a timezone-aware Telegram message with prediction and Mini App button', () => {
    const message = buildMatchReminderMessage(match, { outcome: 'home', homeScore: 2, awayScore: 1 });
    expect(message).toContain('پرسپولیس — استقلال');
    expect(message).toContain('پیش‌بینی شما: برد پرسپولیس (۲–۱)');
    expect(message).toContain('۲۰:۳۰');
    expect(matchReminderButton('match-1').reply_markup.inline_keyboard[0][0]).toEqual({
      text: 'بازکردن مسابقه',
      web_app: { url: 'http://localhost:3000/matches/match-1' }
    });
  });

  it('only marks Telegram 403 responses as forbidden', () => {
    expect(isTelegramForbidden({ response: { error_code: 403 } })).toBe(true);
    expect(isTelegramForbidden({ response: { error_code: 401 } })).toBe(false);
  });

  it('delivers the complete reminder through the Telegram adapter', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ message_id: 1 });
    await sendMatchReminderMessage({ sendMessage } as never, 123456, match, { outcome: 'draw' });
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(
      123456,
      expect.stringContaining('پیش‌بینی شما: مساوی'),
      expect.objectContaining({ parse_mode: 'HTML' })
    );
  });
});
