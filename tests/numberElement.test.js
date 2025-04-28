import { describe, it, expect } from 'vitest';
import { validateNumberElement } from '../src/validate.js';
import testCases from './data/number-element-test-cases.json' assert { type: 'json' };


describe('numberElement (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, validExpected }) => {
    it(description, () => {
      const errors = validateNumberElement(elementDef, elementVal);
      const isValid = errors.length === 0;
      expect(isValid).toBe(validExpected);
    });
  });
});