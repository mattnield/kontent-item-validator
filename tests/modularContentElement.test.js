import { describe, it, expect } from 'vitest';
import testCases from './data/modular-content-element-test-cases.json' assert { type: 'json' };
import { validateModularContentElement } from '../src/validate.js';


describe('validateModularContent (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, linkedItems, contentTypes, validExpected }) => {
    it(description, () => {
      const errors = validateModularContentElement(elementDef, elementVal, contentTypes);
      const isValid = errors.length === 0;
      expect(isValid).toBe(validExpected);
    });
  });
});