import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme', () => {
  it('exposes Priya\'s primary forest green', () => {
    expect(theme.colors.primary).toBe('#007972');
  });

  it('exposes leafy green and dark green variants', () => {
    expect(theme.colors.leafyGreen).toBe('#19AFA2');
    expect(theme.colors.darkGreen).toBe('#4D9999');
  });

  it('exposes secondary blue', () => {
    expect(theme.colors.secondaryBlue).toBe('#27879F');
  });

  it('exposes yellow accents', () => {
    expect(theme.colors.yellow).toBe('#F9E169');
    expect(theme.colors.darkYellow).toBe('#D7BD37');
  });

  it('exposes neutrals', () => {
    expect(theme.colors.darkBlack).toBe('#111111');
    expect(theme.colors.mildBlack).toBe('#2C2C2C');
    expect(theme.colors.darkBlue).toBe('#092C4C');
  });

  it('uses Lexend for headings and Roboto for body', () => {
    expect(theme.fonts.heading).toContain('Lexend');
    expect(theme.fonts.body).toContain('Roboto');
  });

  it('defines Lexend heading sizes H1..H5', () => {
    expect(theme.fontSizes.h1).toBe('39px');
    expect(theme.fontSizes.h5).toBe('16px');
  });

  it('defines Roboto body sizes', () => {
    expect(theme.fontSizes.bodyLarge).toBe('31px');
    expect(theme.fontSizes.bodyMedium).toBe('20px');
    expect(theme.fontSizes.bodyNormal).toBe('16px');
    expect(theme.fontSizes.bodySmall).toBe('14px');
  });
});
