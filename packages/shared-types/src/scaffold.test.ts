import { describe, expect, it } from 'vitest';
import { SHARED_TYPES_PACKAGE } from './index';

describe('scaffold', () => {
  it('package resolves', () => {
    expect(SHARED_TYPES_PACKAGE).toBe('@quizicius/shared-types');
  });
});
