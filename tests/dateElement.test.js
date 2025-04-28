import { describe, it, expect } from 'vitest';
import { validateDateElement } from '../src/validate.js';
import testCases from './data/date-element-test-cases.json' assert { type: 'json' };


describe('dateElement (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, validExpected }) => {
    it(description, () => {
      const errors = validateDateElement(elementDef, elementVal);
      const isValid = errors.length === 0;
      expect(isValid).toBe(validExpected);
    });
  });
});