const sum = require('../src/sum');

describe('sum', () => {
  test('adds two positive numbers', () => {
    expect(sum(2, 3)).toBe(5);
  });

  test('adds negative numbers', () => {
    expect(sum(-2, -3)).toBe(-5);
  });

  test('adds decimals', () => {
    expect(sum(0.1, 0.2)).toBeCloseTo(0.3);
  });
});
