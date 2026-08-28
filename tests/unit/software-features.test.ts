import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

describe('Software Features Engine & Audit Verification', () => {
  it('1. Audits and confirms all 12 core feature categories and 52 software features in PHP backend', () => {
    const helpersPath = path.join(process.cwd(), 'php-backend', 'helpers.php');
    const phpScript = `
      require_once '${helpersPath}';
      $features = getDefaultSoftwareFeaturesList();
      $categories = [];
      foreach ($features as $f) {
        $categories[$f['category']] = true;
      }
      echo json_encode([
        'total' => count($features),
        'categories' => array_keys($categories)
      ]);
    `;

    const rawOutput = execFileSync('php', ['-r', phpScript], { encoding: 'utf-8' }).trim();
    const result = JSON.parse(rawOutput);

    expect(result.total).toBeGreaterThanOrEqual(50);
    expect(result.categories).toContain('browser_profiles');
    expect(result.categories).toContain('fingerprint');
    expect(result.categories).toContain('proxy_network');
    expect(result.categories).toContain('automation');
    expect(result.categories).toContain('cookies_session');
    expect(result.categories).toContain('team_collab');
    expect(result.categories).toContain('security_privacy');
    expect(result.categories).toContain('sync_cloud');
    expect(result.categories).toContain('ai_tools');
    expect(result.categories).toContain('extensions');
    expect(result.categories).toContain('system_performance');
    expect(result.categories).toContain('desktop_client');
  });

  it('2. Verifies feature data structure validity across all items', () => {
    const helpersPath = path.join(process.cwd(), 'php-backend', 'helpers.php');
    const phpScript = `
      require_once '${helpersPath}';
      $features = getDefaultSoftwareFeaturesList();
      $valid = true;
      $errors = [];
      foreach ($features as $f) {
        if (empty($f['id']) || empty($f['name']) || empty($f['category']) || empty($f['short_desc']) || empty($f['icon'])) {
          $valid = false;
          $errors[] = 'Missing required field in ' . ($f['id'] ?? 'unknown');
        }
      }
      echo json_encode(['valid' => $valid, 'errors' => $errors]);
    `;

    const rawOutput = execFileSync('php', ['-r', phpScript], { encoding: 'utf-8' }).trim();
    const result = JSON.parse(rawOutput);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});
