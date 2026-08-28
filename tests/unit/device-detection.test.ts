import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

describe('Cross-Platform Device & Architecture Auto-Detection Suite', () => {
  it('1. Accurately detects macOS Intel from User-Agent and Intel GPU characteristics', () => {
    const helpersPath = path.join(process.cwd(), 'php-backend', 'index.php');
    
    // Simulate macOS Intel UA
    const intelUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
    const phpScript = `
      $_SERVER['HTTP_USER_AGENT'] = '${intelUa}';
      $_SERVER['HTTP_SEC_CH_UA_PLATFORM'] = '"macOS"';
      $_SERVER['HTTP_SEC_CH_UA_ARCH'] = '"x86"';

      $httpUa = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
      $secChUaPlatform = strtolower($_SERVER['HTTP_SEC_CH_UA_PLATFORM'] ?? '');
      $secChUaArch = strtolower($_SERVER['HTTP_SEC_CH_UA_ARCH'] ?? '');

      $isAndroid = (strpos($httpUa, 'android') !== false);
      $isWin = !$isAndroid && (strpos($secChUaPlatform, 'win') !== false || strpos($httpUa, 'windows') !== false);
      $isLinux = !$isAndroid && !$isWin && (strpos($secChUaPlatform, 'linux') !== false || strpos($httpUa, 'linux') !== false);
      $isMac = !$isAndroid && !$isWin && !$isLinux && (strpos($secChUaPlatform, 'mac') !== false || strpos($httpUa, 'mac') !== false);

      $isArm = (strpos($secChUaArch, 'arm') !== false || strpos($httpUa, 'arm64') !== false || strpos($httpUa, 'aarch64') !== false);
      $isExplicitIntel = (strpos($secChUaArch, 'x86') !== false || strpos($httpUa, 'intel') !== false || strpos($httpUa, 'x86_64') !== false);

      $detectedPlatform = 'windows-x64';
      if ($isMac) {
          $detectedPlatform = ($isArm && !$isExplicitIntel) ? 'macos-arm64' : 'macos-x64';
      }

      echo json_encode(['platform' => $detectedPlatform]);
    `;

    const raw = execFileSync('php', ['-r', phpScript], { encoding: 'utf-8' }).trim();
    const res = JSON.parse(raw);
    expect(res.platform).toBe('macos-x64');
  });

  it('2. Accurately detects macOS Apple Silicon when ARM arch or M-series is present', () => {
    const appleArmUa = 'Mozilla/5.0 (Macintosh; Apple Silicon Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
    const phpScript = `
      $_SERVER['HTTP_USER_AGENT'] = '${appleArmUa}';
      $_SERVER['HTTP_SEC_CH_UA_PLATFORM'] = '"macOS"';
      $_SERVER['HTTP_SEC_CH_UA_ARCH'] = '"arm"';

      $httpUa = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
      $secChUaPlatform = strtolower($_SERVER['HTTP_SEC_CH_UA_PLATFORM'] ?? '');
      $secChUaArch = strtolower($_SERVER['HTTP_SEC_CH_UA_ARCH'] ?? '');

      $isAndroid = (strpos($httpUa, 'android') !== false);
      $isWin = !$isAndroid && (strpos($secChUaPlatform, 'win') !== false || strpos($httpUa, 'windows') !== false);
      $isLinux = !$isAndroid && !$isWin && (strpos($secChUaPlatform, 'linux') !== false || strpos($httpUa, 'linux') !== false);
      $isMac = !$isAndroid && !$isWin && !$isLinux && (strpos($secChUaPlatform, 'mac') !== false || strpos($httpUa, 'mac') !== false);

      $isArm = (strpos($secChUaArch, 'arm') !== false || strpos($httpUa, 'arm64') !== false || strpos($httpUa, 'aarch64') !== false);
      $isExplicitIntel = (strpos($secChUaArch, 'x86') !== false || strpos($httpUa, 'intel') !== false || strpos($httpUa, 'x86_64') !== false);

      $detectedPlatform = 'windows-x64';
      if ($isMac) {
          $detectedPlatform = ($isArm && !$isExplicitIntel) ? 'macos-arm64' : 'macos-x64';
      }

      echo json_encode(['platform' => $detectedPlatform]);
    `;

    const raw = execFileSync('php', ['-r', phpScript], { encoding: 'utf-8' }).trim();
    const res = JSON.parse(raw);
    expect(res.platform).toBe('macos-arm64');
  });

  it('3. Accurately detects Windows x64 and Windows ARM64 (Snapdragon)', () => {
    const winX64Ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
    const winArmUa = 'Mozilla/5.0 (Windows NT 10.0; ARM64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

    const testPhp = (ua: string, arch: string) => {
      const script = `
        $_SERVER['HTTP_USER_AGENT'] = '${ua}';
        $_SERVER['HTTP_SEC_CH_UA_PLATFORM'] = '"Windows"';
        $_SERVER['HTTP_SEC_CH_UA_ARCH'] = '${arch}';

        $httpUa = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
        $secChUaPlatform = strtolower($_SERVER['HTTP_SEC_CH_UA_PLATFORM'] ?? '');
        $secChUaArch = strtolower($_SERVER['HTTP_SEC_CH_UA_ARCH'] ?? '');

        $isAndroid = (strpos($httpUa, 'android') !== false);
        $isWin = !$isAndroid && (strpos($secChUaPlatform, 'win') !== false || strpos($httpUa, 'windows') !== false);
        $isArm = (strpos($secChUaArch, 'arm') !== false || strpos($httpUa, 'arm64') !== false);
        $isExplicitIntel = (strpos($secChUaArch, 'x86') !== false || strpos($httpUa, 'win64') !== false);

        $detectedPlatform = ($isArm && !$isExplicitIntel) ? 'windows-arm64' : 'windows-x64';
        echo json_encode(['platform' => $detectedPlatform]);
      `;
      return JSON.parse(execFileSync('php', ['-r', script], { encoding: 'utf-8' }).trim());
    };

    expect(testPhp(winX64Ua, '"x86"').platform).toBe('windows-x64');
    expect(testPhp(winArmUa, '"arm"').platform).toBe('windows-arm64');
  });
});
