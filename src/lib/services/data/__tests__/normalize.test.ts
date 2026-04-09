import { describe, it, expect } from 'vitest';
import { normalizeAddress } from '../normalize';

describe('normalizeAddress', () => {
  it('produces identical output regardless of input case', () => {
    expect(normalizeAddress('123 Main Street, Dallas, TX')).toBe(
      normalizeAddress('123 main street, dallas, tx')
    );
  });

  it('normalizes mixed case with uppercase abbreviation', () => {
    expect(normalizeAddress('456 Oak Avenue Apt 2B')).toBe(
      normalizeAddress('456 OAK AVE APT 2B')
    );
  });

  it('trims leading and trailing whitespace', () => {
    const result = normalizeAddress('  789 Elm Blvd  ');
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
  });

  it('collapses multiple interior spaces to single space', () => {
    const result = normalizeAddress('789  elm  blvd');
    expect(result).not.toMatch(/\s{2,}/);
  });

  it('removes periods from abbreviations like "St." -> "ST"', () => {
    const result = normalizeAddress('100 Main St. Dallas TX');
    expect(result).not.toContain('.');
  });

  it('replaces STREET with ST', () => {
    expect(normalizeAddress('100 Main Street')).toContain('ST');
    expect(normalizeAddress('100 Main Street')).not.toContain('STREET');
  });

  it('replaces AVENUE with AVE', () => {
    expect(normalizeAddress('100 Oak Avenue')).toContain('AVE');
    expect(normalizeAddress('100 Oak Avenue')).not.toContain('AVENUE');
  });

  it('replaces BOULEVARD with BLVD', () => {
    expect(normalizeAddress('100 Oak Boulevard')).toContain('BLVD');
    expect(normalizeAddress('100 Oak Boulevard')).not.toContain('BOULEVARD');
  });

  it('replaces DRIVE with DR', () => {
    expect(normalizeAddress('100 Oak Drive')).toContain('DR');
    expect(normalizeAddress('100 Oak Drive')).not.toContain('DRIVE');
  });

  it('replaces LANE with LN', () => {
    expect(normalizeAddress('100 Oak Lane')).toContain('LN');
    expect(normalizeAddress('100 Oak Lane')).not.toContain('LANE');
  });

  it('replaces ROAD with RD', () => {
    expect(normalizeAddress('100 Oak Road')).toContain('RD');
    expect(normalizeAddress('100 Oak Road')).not.toContain('ROAD');
  });

  it('replaces COURT with CT', () => {
    expect(normalizeAddress('100 Oak Court')).toContain('CT');
    expect(normalizeAddress('100 Oak Court')).not.toContain('COURT');
  });

  it('replaces CIRCLE with CIR', () => {
    expect(normalizeAddress('100 Oak Circle')).toContain('CIR');
    expect(normalizeAddress('100 Oak Circle')).not.toContain('CIRCLE');
  });

  it('replaces PLACE with PL', () => {
    expect(normalizeAddress('100 Oak Place')).toContain('PL');
    expect(normalizeAddress('100 Oak Place')).not.toContain('PLACE');
  });

  it('replaces APARTMENT with APT', () => {
    expect(normalizeAddress('100 Oak St Apartment 2')).toContain('APT');
    expect(normalizeAddress('100 Oak St Apartment 2')).not.toContain('APARTMENT');
  });

  it('replaces SUITE with STE', () => {
    expect(normalizeAddress('100 Oak St Suite 200')).toContain('STE');
    expect(normalizeAddress('100 Oak St Suite 200')).not.toContain('SUITE');
  });

  it('replaces NORTH with N', () => {
    expect(normalizeAddress('100 North Oak St')).toContain('N');
    expect(normalizeAddress('100 North Oak St')).not.toContain('NORTH');
  });

  it('replaces SOUTH with S', () => {
    expect(normalizeAddress('100 South Oak St')).not.toContain('SOUTH');
  });

  it('replaces EAST with E', () => {
    expect(normalizeAddress('100 East Oak St')).not.toContain('EAST');
  });

  it('replaces WEST with W', () => {
    expect(normalizeAddress('100 West Oak St')).not.toContain('WEST');
  });

  it('normalizes comma spacing: "Dallas,TX" -> "DALLAS, TX"', () => {
    const result = normalizeAddress('Dallas,TX');
    expect(result).toContain('DALLAS, TX');
  });

  it('end-to-end: two differently formatted versions of same address produce identical output', () => {
    const v1 = normalizeAddress('  123  Main  Street,  Dallas,  TX  75201  ');
    const v2 = normalizeAddress('123 main street, dallas, tx 75201');
    expect(v1).toBe(v2);
  });

  it('end-to-end: abbreviated and long-form versions match', () => {
    const longForm = normalizeAddress('456 Oak Avenue, Apt 2B, Irving, TX 75039');
    const shortForm = normalizeAddress('456 oak ave, apt 2b, irving, tx 75039');
    expect(longForm).toBe(shortForm);
  });
});
