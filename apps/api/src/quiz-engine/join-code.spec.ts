import { generateJoinCode } from './join-code';

describe('generateJoinCode', () => {
  it('generates a 4-character code from the unambiguous alphabet', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(4);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });

  it('generates different codes across calls (probabilistically)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
