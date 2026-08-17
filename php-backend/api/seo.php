<?php
// ──────────────────────────────────────────────
// ProfileVault — PHP SEO & AEO Management REST API
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

sendJsonHeader();
$db = Database::getConnection();
$adminUser = requireAdmin();
$action = $_GET['action'] ?? $_POST['action'] ?? 'get-settings';
$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody, true) ?? $_POST;

try {
    switch ($action) {
        case 'get-settings':
            $stmt = $db->query("SELECT `key`, `value` FROM `seo_settings`");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $settings = [];
            foreach ($rows as $r) {
                $settings[$r['key']] = $r['value'];
            }
            respondJson(['success' => true, 'data' => $settings]);
            break;

        case 'save-settings':
            if (!is_array($input)) {
                respondJson(['success' => false, 'error' => 'Invalid input.'], 400);
            }
            $stmt = $db->prepare("INSERT INTO `seo_settings` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
            foreach ($input as $k => $v) {
                $stmt->execute([$k, (string)$v]);
            }
            respondJson(['success' => true, 'message' => 'SEO settings updated successfully.']);
            break;

        case 'get-pages':
            $stmt = $db->query("SELECT * FROM `page_seo` ORDER BY `page_path` ASC");
            respondJson(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'save-page':
            $id = $input['id'] ?? ('page_' . bin2hex(random_bytes(6)));
            $path = trim($input['page_path'] ?? '/');
            $title = trim($input['title'] ?? 'ProfileVault');
            $description = trim($input['description'] ?? '');

            $stmt = $db->prepare("
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
            break;

        case 'delete-page':
            $path = trim($input['page_path'] ?? $_GET['page_path'] ?? '');
            if (!$path || $path === '/') {
                respondJson(['success' => false, 'error' => 'Cannot delete default homepage path.'], 400);
            }
            $stmt = $db->prepare("DELETE FROM `page_seo` WHERE `page_path` = ?");
            $stmt->execute([$path]);
            respondJson(['success' => true, 'message' => 'SEO page deleted successfully.']);
            break;

        case 'get-keywords':
            $stmt = $db->query("SELECT * FROM `seo_keywords` ORDER BY `created_at` DESC");
            $keywords = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $urlMap = [];
            foreach ($keywords as $k) {
                $kw = strtolower(trim($k['keyword']));
                if (!isset($urlMap[$kw])) $urlMap[$kw] = [];
                $urlMap[$kw][] = $k['target_url'];
            }

            $warnings = [];
            foreach ($urlMap as $kw => $urls) {
                $uniqueUrls = array_unique($urls);
                if (count($uniqueUrls) > 1) {
                    $warnings[] = ['keyword' => $kw, 'urls' => array_values($uniqueUrls)];
                }
            }

            respondJson(['success' => true, 'data' => ['keywords' => $keywords, 'warnings' => $warnings]]);
            break;

        case 'save-keyword':
            $id = $input['id'] ?? ('kw_' . bin2hex(random_bytes(6)));
            $kw = strtolower(trim($input['keyword'] ?? ''));

            $stmt = $db->prepare("
                INSERT INTO `seo_keywords` (`id`, `keyword`, `keyword_type`, `search_intent`, `target_url`, `country`, `language`, `status`, `ranking_position`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    `keyword` = VALUES(`keyword`),
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
            break;

        case 'delete-keyword':
            $id = $_GET['id'] ?? $input['id'] ?? '';
            $stmt = $db->prepare("DELETE FROM `seo_keywords` WHERE `id` = ?");
            $stmt->execute([$id]);
            respondJson(['success' => true, 'message' => 'Keyword deleted.']);
            break;

        case 'get-redirects':
            $stmt = $db->query("SELECT * FROM `seo_redirects` ORDER BY `created_at` DESC");
            respondJson(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'save-redirect':
            $id = $input['id'] ?? ('red_' . bin2hex(random_bytes(6)));

            $stmt = $db->prepare("
                INSERT INTO `seo_redirects` (`id`, `source_path`, `target_path`, `status_code`)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    `target_path` = VALUES(`target_path`),
                    `status_code` = VALUES(`status_code`)
            ");

            $stmt->execute([
                $id,
                $input['source_path'],
                $input['target_path'],
                (int)($input['status_code'] ?? 301)
            ]);

            respondJson(['success' => true, 'message' => 'Redirect saved.']);
            break;

        case 'get-404-logs':
            $stmt = $db->query("SELECT * FROM `seo_404_logs` ORDER BY `hit_count` DESC LIMIT 50");
            respondJson(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        default:
            respondJson(['success' => false, 'error' => 'Invalid SEO action: ' . htmlspecialchars($action)], 400);
    }
} catch (Throwable $e) {
    respondJson(['success' => false, 'error' => $e->getMessage()], 500);
}
