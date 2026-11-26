import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Shift, SHIFTS } from './enums';

describe('enums', () => {
  it('expone los valores como tupla usable por Zod', () => {
    const schema = z.enum(SHIFTS);
    expect(schema.parse(Shift.NIGHT)).toBe('NIGHT');
    expect(() => schema.parse('MORNING')).toThrow();
  });
});
