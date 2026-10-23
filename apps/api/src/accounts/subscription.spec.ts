import { addMonths, today } from './subscription';

describe('subscription dates', () => {
  it('uses the Slovak calendar day, not UTC', () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Bratislava (CET, UTC+1).
    expect(today(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
    // 22:30 UTC in summer is already the next day (CEST, UTC+2).
    expect(today(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
  });

  it('adds calendar months, keeping the day where the month allows it', () => {
    expect(addMonths('2026-10-23', 1)).toBe('2026-11-23');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
});
