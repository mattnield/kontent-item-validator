import { describe, it, expect } from 'vitest';
import testCases from './data/multiplechoice-element-test-cases.json' assert { type: 'json' };
import { validateMultipleChoiceElement } from '../src/validate.js';


describe('multiplechoiceContent (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, contentTypes, validExpected }) => {
    it(description, () => {
      const errors = validateMultipleChoiceElement(elementDef, elementVal);
      const isValid = errors.length === 0;
      expect(isValid).toBe(validExpected);
    });
  });
});