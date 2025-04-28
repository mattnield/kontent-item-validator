import { describe, it, expect } from 'vitest';
import { validateTextElement } from '../src/validate.js';
import testCases from './data/text-element-test-cases.json' assert { type: 'json' };


describe('textElement (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, validExpected }) => {
    it(description, () => {
      const errors = validateTextElement(elementDef, elementVal);
      const isValid = errors.length === 0;
      expect(isValid).toBe(validExpected);
    });
  });
});