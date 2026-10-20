// Excludes 0/O and 1/I so a host can read a code aloud without ambiguity.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateJoinCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
