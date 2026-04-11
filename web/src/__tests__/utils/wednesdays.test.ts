import { describe, expect, it } from 'vitest';
import {
  getFourthWednesday,
  getDefaultEventDate,
  isFourthWednesday,
  formatLocalDate,
} from '@/utils/wednesdays';

describe('getFourthWednesday', () => {
  it('month starting on Wednesday (Jan 2025 starts Wed) → 4th Wed is Jan 22', () => {
    const d = getFourthWednesday(2025, 0);
    expect(formatLocalDate(d)).toBe('2025-01-22');
  });

  it('month starting on Saturday (Feb 2025 starts Sat) → 4th Wed is Feb 26', () => {
    const d = getFourthWednesday(2025, 1);
    expect(formatLocalDate(d)).toBe('2025-02-26');
  });

  it('month starting on Sunday (Jun 2025 starts Sun) → 4th Wed is Jun 25', () => {
    const d = getFourthWednesday(2025, 5);
    expect(formatLocalDate(d)).toBe('2025-06-25');
  });

  it('month starting on Thursday (May 2025 starts Thu) → 4th Wed is May 28', () => {
    const d = getFourthWednesday(2025, 4);
    expect(formatLocalDate(d)).toBe('2025-05-28');
  });
});

describe('getDefaultEventDate', () => {
  it('before the 4th Wed of current month → returns that 4th Wed', () => {
    const today = new Date(2025, 0, 5);
    expect(formatLocalDate(getDefaultEventDate(today))).toBe('2025-01-22');
  });

  it('exactly on 4th Wed of current month → still returns that 4th Wed', () => {
    const today = new Date(2025, 0, 22);
    expect(formatLocalDate(getDefaultEventDate(today))).toBe('2025-01-22');
  });

  it('after 4th Wed of current month → returns 4th Wed of next month', () => {
    const today = new Date(2025, 0, 23);
    expect(formatLocalDate(getDefaultEventDate(today))).toBe('2025-02-26');
  });

  it('late December rolls into January of next year', () => {
    const today = new Date(2025, 11, 30);
    expect(formatLocalDate(getDefaultEventDate(today))).toBe('2026-01-28');
  });
});

describe('isFourthWednesday', () => {
  it('Jan 22 2025 is 4th Wed', () => {
    expect(isFourthWednesday(new Date(2025, 0, 22))).toBe(true);
  });
  it('Jan 15 2025 (3rd Wed) is not', () => {
    expect(isFourthWednesday(new Date(2025, 0, 15))).toBe(false);
  });
  it('Jan 29 2025 (5th Wed) is not', () => {
    expect(isFourthWednesday(new Date(2025, 0, 29))).toBe(false);
  });
  it('a Tuesday in the 22-28 range is not', () => {
    expect(isFourthWednesday(new Date(2025, 0, 28))).toBe(false);
  });
});
