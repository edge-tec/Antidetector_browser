<?php
// ──────────────────────────────────────────────
// ProfileVault — PHP SEO & AEO Management REST API
// ──────────────────────────────────────────────

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

$pdo = getDbConnection();
$action = $_GET['action'] ?? 'get-settings';

// Admin Authorization Check
function requireAdminAuth($pdo) {
    $token = getBearerToken();
    if (!$token) {
        respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
    }
    $stmt = $pdo->prepare("SELECT u.* FROM users u JOIN user_sessions s ON u.id = s.user_id WHERE s.session_token = ? AND s.expires_at > NOW()");
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user || $user['role'] !== 'admin') {
        respondJson(['success' => false, 'error' => 'Admin authorization required.'], 403);
    }
    return $user;
}

if ($action === 'get-settings') {
    requireAdminAuth($pdo);
    $stmt = $pdo->query("SELECT `key`, `value` FROM `seo_settings`");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $settings = [];
    foreach ($rows as $r) {
        $settings[$r['key']] = $r['value'];
    }
    respondJson(['success' => true, 'data' => $settings]);
}

if ($action === 'save-settings') {
    requireAdminAuth($pdo);
    $input = getJsonInput();
    if (!is_array($input)) {
        respondJson(['success' => false, 'error' => 'Invalid input.'], 400);
    }
    $stmt = $pdo->prepare("INSERT INTO `seo_settings` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    foreach ($input as $k => $v) {
        $stmt->execute([$k, (string)$v]);
    }
    respondJson(['success' => true, 'message' => 'SEO settings updated successfully.']);
}

if ($action === 'get-pages') {
    requireAdminAuth($pdo);
    $stmt = $pdo->query("SELECT * FROM `page_seo` ORDER BY `page_path` ASC");
    respondJson(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($action === 'save-page') {
    requireAdminAuth($pdo);
    $input = getJsonInput();
    $id = $input['id'] ?? 'page_' . substr(md5(uniqid()), 0, 8);
    $path = $input['page_path'] ?? '/';
    $title = $input['title'] ?? 'ProfileVault';
    $description = $input['description'] ?? '';

    $stmt = $pdo->prepare("
        INSERT INTO `page_seo` (
            `id`, `page_path`, `page_type`, `title`, `description`, `keywords`, `canonical_url`, `robots`,
            `og_title`, `og_description`, `og_image`, `twitter_card`, `twitter_title`, `twitter_description`,
            `schema_type`, `primary_keyword`, `ai_quick_answer`, `structured_data_json`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            `title` = VALUES(`title`),
            `description` = VALUES(`description`),
            `keywords` = VALUES(`keywords`),
            `canonical_url` = VALUES(`canonical_url`),
            `robots` = VALUES(`robots`),
            `og_title` = VALUES(`og_title`),
            `og_description` = VALUES(`og_description`),
            `og_image` = VALUES(`og_image`),
            `twitter_card` = VALUES(`twitter_card`),
            `twitter_title` = VALUES(`twitter_title`),
            `twitter_description` = VALUES(`twitter_description`),
            `schema_type` = VALUES(`schema_type`),
            `primary_keyword` = VALUES(`primary_keyword`),
            `ai_quick_answer` = VALUES(`ai_quick_answer`),
            `structured_data_json` = VALUES(`structured_data_json`)
    ");

    $stmt->execute([
        $id,
        $path,
        $input['page_type'] ?? 'webpage',
        $title,
        $description,
        $input['keywords'] ?? '',
        $input['canonical_url'] ?? '',
        $input['robots'] ?? 'index, follow',
        $input['og_title'] ?? $title,
        $input['og_description'] ?? $description,
        $input['og_image'] ?? '',
        $input['twitter_card'] ?? 'summary_large_image',
        $input['twitter_title'] ?? $title,
        $input['twitter_description'] ?? $description,
        $input['schema_type'] ?? 'SoftwareApplication',
        $input['primary_keyword'] ?? '',
        $input['ai_quick_answer'] ?? '',
        $input['structured_data_json'] ?? ''
    ]);

    respondJson(['success' => true, 'message' => 'Page SEO saved successfully.']);
}

if ($action === 'get-keywords') {
    requireAdminAuth($pdo);
    $stmt = $pdo->query("SELECT * FROM `seo_keywords` ORDER BY `created_at` DESC");
    respondJson(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($action === 'save-keyword') {
    requireAdminAuth($pdo);
    $input = getJsonInput();
    $id = $input['id'] ?? 'kw_' . substr(md5(uniqid()), 0, 8);
    $kw = strtolower(trim($input['keyword'] ?? ''));

    $stmt = $pdo->prepare("
        INSERT INTO `seo_keywords` (`id`, `keyword`, `keyword_type`, `search_intent`, `target_url`, `country`, `language`, `status`, `ranking_position`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            `keyword_type` = VALUES(`keyword_type`),
            `search_intent` = VALUES(`search_intent`),
            `target_url` = VALUES(`target_url`),
            `country` = VALUES(`country`),
            `language` = VALUES(`language`),
            `status` = VALUES(`status`),
            `ranking_position` = VALUES(`ranking_position`)
    ");

    $stmt->execute([
        $id,
        $kw,
        $input['keyword_type'] ?? 'primary',
        $input['search_intent'] ?? 'commercial',
        $input['target_url'] ?? '/',
        $input['country'] ?? 'US',
        $input['language'] ?? 'en',
        $input['status'] ?? 'active',
        (int)($input['ranking_position'] ?? 0)
    ]);

    respondJson(['success' => true, 'message' => 'Keyword saved successfully.']);
}

respondJson(['success' => false, 'error' => 'Invalid action.'], 400);
