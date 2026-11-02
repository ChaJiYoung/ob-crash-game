import { describe, it, expect } from 'vitest';
import { validateNicknameInput } from '../src/controller/components/LoginAndPermissionGate';
import { resolveRouteMode } from '../src/App';

describe('Controller Login Validation & App Route Resolution', () => {
  it('should validate nickname input length between 2 and 10 characters', () => {
    expect(validateNicknameInput('').valid).toBe(false);
    expect(validateNicknameInput('   ').valid).toBe(false);
    expect(validateNicknameInput('A').valid).toBe(false);
    expect(validateNicknameInput('맥').valid).toBe(false);

    const normal = validateNicknameInput('  맥주헌터  ');
    expect(normal.valid).toBe(true);
    expect(normal.trimmed).toBe('맥주헌터');

    expect(validateNicknameInput('1234567890').valid).toBe(true);
    expect(validateNicknameInput('12345678901').valid).toBe(false); // 11 characters
  });

  it('should resolve routing mode correctly based on pathname and search query', () => {
    expect(resolveRouteMode('/', '')).toBe('PC');
    expect(resolveRouteMode('/play', '')).toBe('PC');
    expect(resolveRouteMode('/controller', '?room=AB12')).toBe('CONTROLLER');
    expect(resolveRouteMode('/controller', '')).toBe('CONTROLLER');
    expect(resolveRouteMode('/', '?room=XYZ9')).toBe('CONTROLLER');

    // Sandbox Test Lab routing
    expect(resolveRouteMode('/sensor-test', '')).toBe('SANDBOX');
    expect(resolveRouteMode('/sensor-test/', '')).toBe('SANDBOX');
    expect(resolveRouteMode('/', '?mode=test')).toBe('SANDBOX');
    expect(resolveRouteMode('/play', '?mode=test')).toBe('SANDBOX');
  });
});
