import { starEditorSafeUrl } from './editor-link';

describe('starEditorSafeUrl', () => {
  it('accepts only safe link addresses', () => {
    expect(starEditorSafeUrl(' https://example.com/a ')).toBe('https://example.com/a');
    expect(starEditorSafeUrl('mailto:orders@example.com')).toBe('mailto:orders@example.com');
    expect(starEditorSafeUrl('tel:+15550100')).toBe('tel:+15550100');
    expect(starEditorSafeUrl('/orders/1042')).toBe('/orders/1042');
    expect(starEditorSafeUrl('example.com/orders')).toBe('https://example.com/orders');
    expect(starEditorSafeUrl('javascript:alert(1)')).toBeNull();
    expect(starEditorSafeUrl('JAVASCRIPT:alert(1)')).toBeNull();
    expect(starEditorSafeUrl('data:text/html,x')).toBeNull();
    expect(starEditorSafeUrl('//evil.example.com')).toBeNull();
    expect(starEditorSafeUrl('/\\evil.example.com')).toBeNull();
    expect(starEditorSafeUrl('https://example.com\\a')).toBeNull();
    expect(starEditorSafeUrl('https://example.com/a b')).toBeNull();
    expect(starEditorSafeUrl('')).toBeNull();
  });
});
