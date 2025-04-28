import { describe, it, expect } from 'vitest';
import { validateAssetElement } from '../src/validate.js';
import testCases from './data/asset-element-test-cases.json' assert { type: 'json' };


describe('assetElement (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, validExpected }) => {
    it(description, () => {
      const errors = validateAssetElement(elementDef, elementVal);
      const isValid = errors.length === 0;
      expect(isValid).toBe(validExpected);
    });
  });
});