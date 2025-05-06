import { describe, it, expect } from 'vitest';
import { validateRichTextElement } from '../src/validate.js';
import testCases from './data/richtext-element-test-cases.json' assert { type: 'json' };


describe('richtextElement (data-driven)', () => {
  testCases.forEach(({ description, elementDef, elementVal, contentTypes, modularContent, validExpected }) => {

    it(description, () => {
      console.log(description);
      const errors = validateRichTextElement(elementDef, elementVal, contentTypes, modularContent);
      if (errors.length > 0) console.error(errors);
      expect(errors.length === 0).toBe(validExpected);
    });
  });
});