import { describe, it, expect } from 'vitest';
import { validateTaxonomyElement } from '../src/validate.js';
import testCases from './data/taxonomy-element-test-cases.json' assert { type: 'json' };

describe('taxonomyElement (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, validExpected }) => {
    it(description, () => {
      const errors = validateTaxonomyElement(elementDef, elementVal);
      const isValid = errors.length === 0;
      expect(isValid).toBe(validExpected);
    });
  });
});