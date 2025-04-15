import { describe, it, expect } from 'vitest';
import { validateCustomElement } from '../src/validate.js';
import testCases from './data/custom-element-test-cases.json' assert { type: 'json' };


describe('customElement (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, validExpected }) => {
    it(description, () => {
      const errors = validateCustomElement(elementDef, elementVal);
      const isValid = errors.length === 0;
      expect(isValid).toBe(validExpected);
    });
  });
});