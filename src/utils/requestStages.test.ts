import { describe, expect, it } from 'vitest';
import { getRequestStage, isOpenRequest } from './requestStages';

describe('request workflow', () => {
  it('keeps suggestions and pre-confirmations out of processed', () => {
    expect(getRequestStage('pending')).toBe('pending');
    expect(getRequestStage('pre_confirmed')).toBe('pending');
    expect(getRequestStage('suggested')).toBe('suggested');
  });
  it('only processes a converted request (conversion creates a confirmed appointment)', () => {
    expect(['pending', 'converted'].map(getRequestStage)).toEqual(['pending', 'processed']);
    expect(['pending', 'suggested', 'pre_confirmed', 'converted'].map(getRequestStage))
      .toEqual(['pending', 'suggested', 'pending', 'processed']);
  });
  it.each(['cancelled', 'rejected', 'expired'])('keeps %s separate from confirmed requests', status => {
    expect(getRequestStage(status)).toBe('closed');
    expect(isOpenRequest(status)).toBe(false);
  });
  it('counts pending, suggested and pre-confirmed as outstanding', () => {
    expect(['pending', 'suggested', 'pre_confirmed'].every(isOpenRequest)).toBe(true);
    expect(isOpenRequest('converted')).toBe(false);
  });
});
