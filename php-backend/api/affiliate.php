<?php
// ──────────────────────────────────────────────
// AntiProfiles — CPA Affiliate & Referral Management API
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

ensureDatabaseTablesExist();
$db = Database::getConnection();
$action = $_GET['action'] ?? '';

// Helper: Ensure user has affiliate ID
function ensureUserAffiliateId(PDO $db, array $user): array {
    $affId = $user['affiliate_id'] ?? null;
    $refCode = $user['referral_code'] ?? null;
    $status = $user['affiliate_status'] ?? 'active';

    if (empty($affId)) {
        try {
            $st = $db->prepare("SELECT affiliate_id, referral_code, affiliate_status FROM users WHERE id = ?");
            $st->execute([$user['id']]);
            $uRow = $st->fetch(PDO::FETCH_ASSOC);
            if (!empty($uRow['affiliate_id'])) {
                $affId = $uRow['affiliate_id'];
                $refCode = $uRow['referral_code'] ?? '';
                $status = $uRow['affiliate_status'] ?? 'active';
            }
        } catch (Throwable $e) {}
    }

    $rawUid = preg_replace('/^usr_/i', '', $user['id'] ?? 'USER');
    $cleanId = strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $rawUid), 0, 6));
    if (strlen($cleanId) < 4) {
        $cleanId = strtoupper(substr(md5($user['id'] ?? 'USER'), 0, 6));
    }

    if (empty($affId) || str_ends_with($affId, '_') || strlen($affId) < 6) {
        $affId = 'AFF-' . $cleanId;
    }

    if (empty($refCode) || str_ends_with($refCode, '_') || strlen($refCode) < 6) {
        $refCode = 'REF_' . $cleanId;
    }

    try {
        $stmt = $db->prepare("UPDATE users SET affiliate_id = ?, referral_code = ?, affiliate_status = ? WHERE id = ?");
        $stmt->execute([$affId, $refCode, $status, $user['id']]);
    } catch (Throwable $e) {}

    return [
        'affiliate_id' => $affId,
        'referral_code' => $refCode,
        'status' => $status ?: 'active'
    ];
}

switch ($action) {

    // ──────────────────────────────────────────────
    // USER PORTAL ENDPOINTS
    // ──────────────────────────────────────────────

    case 'get-summary':
        $user = getAuthenticatedUser();
        if (!$user) {
            respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
        }

        $affInfo = ensureUserAffiliateId($db, $user);
        $affInfo = ensureUserAffiliateId($db, $user);
        $affId = $affInfo['affiliate_id'];
        $refCode = $affInfo['referral_code'];

        $cleanSuffix = preg_replace('/^(REF_|AFF-)/i', '', $refCode);
        $searchAffIds = array_values(array_unique(array_filter([
            $affId, 
            $refCode, 
            $cleanSuffix, 
            'REF_' . $cleanSuffix, 
            'AFF-' . $cleanSuffix, 
            $user['id']
        ])));
        $inPlaceholders = implode(',', array_fill(0, count($searchAffIds), '?'));

        // Clicks count
        $stmtClicks = $db->prepare("SELECT COUNT(*) as total, COUNT(DISTINCT ip_address) as unique_ips FROM affiliate_clicks WHERE affiliate_id IN ($inPlaceholders)");
        $stmtClicks->execute($searchAffIds);
        $clickStats = $stmtClicks->fetch(PDO::FETCH_ASSOC);

        // Conversions & Commissions
        $stmtConv = $db->prepare("SELECT COUNT(*) as total_conversions, COALESCE(SUM(payout_amount), 0) as total_earnings FROM affiliate_conversions WHERE affiliate_id IN ($inPlaceholders) OR user_id = ? AND status = 'approved'");
        $stmtConv->execute(array_merge($searchAffIds, [$user['id']]));
        $convStats = $stmtConv->fetch(PDO::FETCH_ASSOC);

        // Paid Withdrawals
        $stmtPaid = $db->prepare("SELECT COALESCE(SUM(amount), 0) as total_paid FROM affiliate_withdrawals WHERE user_id = ? AND status = 'paid'");
        $stmtPaid->execute([$user['id']]);
        $paidRow = $stmtPaid->fetch(PDO::FETCH_ASSOC);
        $totalPaid = (float)($paidRow['total_paid'] ?? 0);

        // Pending Hold Withdrawals
        $stmtPending = $db->prepare("SELECT COALESCE(SUM(amount), 0) as total_pending FROM affiliate_withdrawals WHERE user_id = ? AND status IN ('pending', 'approved', 'processing')");
        $stmtPending->execute([$user['id']]);
        $pendingRow = $stmtPending->fetch(PDO::FETCH_ASSOC);
        $pendingHold = (float)($pendingRow['total_pending'] ?? 0);

        // Manual Balance Adjustments
        $stmtAdj = $db->prepare("SELECT COALESCE(SUM(amount), 0) as total_adj FROM affiliate_balance_adjustments WHERE user_id = ?");
        $adjTotal = 0;
        try {
            $stmtAdj->execute([$user['id']]);
            $adjRow = $stmtAdj->fetch(PDO::FETCH_ASSOC);
            $adjTotal = (float)($adjRow['total_adj'] ?? 0);
        } catch (Throwable $e) {}

        $totalEarnings = (float)($convStats['total_earnings'] ?? 0) + $adjTotal;
        $availableBalance = max(0, $totalEarnings - $totalPaid - $pendingHold);

        // Conversion Rate
        $totalClicks = (int)($clickStats['total'] ?? 0);
        $totalConversions = (int)($convStats['total_conversions'] ?? 0);
        $conversionRate = $totalClicks > 0 ? round(($totalConversions / $totalClicks) * 100, 2) : 0;

        // Postback Configuration
        $stmtPb = $db->prepare("SELECT postback_url, http_method, is_active FROM affiliate_postback_configs WHERE affiliate_id IN ($inPlaceholders) LIMIT 1");
        $stmtPb->execute($searchAffIds);
        $postbackConfig = $stmtPb->fetch(PDO::FETCH_ASSOC);

        // Recent Clicks (last 50)
        $stmtRecClicks = $db->prepare("
            SELECT c.*, o.title as offer_title 
            FROM affiliate_clicks c 
            LEFT JOIN affiliate_offers o ON o.id = c.offer_id 
            WHERE c.affiliate_id IN ($inPlaceholders) 
            ORDER BY c.created_at DESC 
            LIMIT 50
        ");
        $stmtRecClicks->execute($searchAffIds);
        $recentClicks = $stmtRecClicks->fetchAll(PDO::FETCH_ASSOC);

        // Recent Conversions (last 30)
        $stmtRecConv = $db->prepare("SELECT conversion_id, click_id, offer_id, order_amount, payout_amount, status, created_at FROM affiliate_conversions WHERE affiliate_id IN ($inPlaceholders) OR user_id = ? ORDER BY created_at DESC LIMIT 30");
        $stmtRecConv->execute(array_merge($searchAffIds, [$user['id']]));
        $recentConversions = $stmtRecConv->fetchAll(PDO::FETCH_ASSOC);

        // Withdrawal History
        $stmtWith = $db->prepare("SELECT id, amount, payout_method, payout_details_json, status, admin_note, payout_reference, created_at FROM affiliate_withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 20");
        $withdrawals = [];
        try {
            $stmtWith->execute([$user['id']]);
            $withdrawals = $stmtWith->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {}

        // Global System Settings
        $stmtSet = $db->prepare("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'affiliate_%'");
        $settings = [];
        try {
            $stmtSet->execute();
            foreach ($stmtSet->fetchAll(PDO::FETCH_ASSOC) as $s) {
                $settings[$s['key']] = $s['value'];
            }
        } catch (Throwable $e) {}

        // Active CPA Offers
        $stmtOffers = $db->prepare("SELECT * FROM affiliate_offers WHERE status = 'active' ORDER BY created_at ASC");
        $offers = [];
        try {
            $stmtOffers->execute();
            $rawOffers = $stmtOffers->fetchAll(PDO::FETCH_ASSOC);
            $offers = array_map(function($o) {
                $payoutType = ($o['payout_type'] === 'fixed') ? 'fixed' : 'percentage';
                $rate = (float)($o['revshare_percent'] ?? $o['commission_rate'] ?? 0);
                return [
                    'id' => $o['id'],
                    'title' => $o['title'],
                    'description' => $o['description'] ?? '',
                    'target_url' => $o['target_url'],
                    'payout_type' => $payoutType,
                    'commission_rate' => $rate,
                    'revshare_percent' => $rate,
                    'fixed_payout_usd' => (float)($o['fixed_payout_usd'] ?? 0),
                    'currency' => $o['currency'] ?? 'USD',
                    'status' => $o['status'] ?? 'active'
                ];
            }, $rawOffers);
        } catch (Throwable $e) {}

        respondJson([
            'success' => true,
            'data' => [
                'affiliateId' => $affId,
                'referralCode' => $affInfo['referral_code'],
                'status' => $affInfo['status'],
                'totalClicks' => $totalClicks,
                'uniqueClicks' => (int)($clickStats['unique_ips'] ?? 0),
                'totalConversions' => $totalConversions,
                'conversionRate' => $conversionRate,
                'lifetimeEarnings' => round($totalEarnings, 2),
                'availableBalance' => round($availableBalance, 2),
                'paidEarnings' => round($totalPaid, 2),
                'pendingHold' => round($pendingHold, 2),
                'postbackConfig' => $postbackConfig ?: null,
                'offers' => $offers,
                'recentClicks' => $recentClicks,
                'recentConversions' => $recentConversions,
                'withdrawals' => $withdrawals,
                'systemSettings' => [
                    'enabled' => ($settings['affiliate_system_enabled'] ?? '1') === '1',
                    'defaultRate' => (float)($settings['affiliate_default_commission_rate'] ?? 15),
                    'minPayout' => (float)($settings['affiliate_min_payout_usd'] ?? 50),
                    'cookieDays' => (int)($settings['affiliate_cookie_duration_days'] ?? 30)
                ]
            ]
        ]);
        break;

    case 'get-offers':
        $onlyActive = !isset($_GET['all']) || $_GET['all'] !== '1';
        $sql = $onlyActive ? "SELECT * FROM affiliate_offers WHERE status = 'active' ORDER BY created_at ASC" : "SELECT * FROM affiliate_offers ORDER BY created_at ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute();
        $rawOffers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $offers = array_map(function($o) {
            $payoutType = ($o['payout_type'] === 'fixed') ? 'fixed' : 'percentage';
            $rate = (float)($o['revshare_percent'] ?? $o['commission_rate'] ?? 0);
            return [
                'id' => $o['id'],
                'title' => $o['title'],
                'description' => $o['description'] ?? '',
                'target_url' => $o['target_url'],
                'payout_type' => $payoutType,
                'commission_rate' => $rate,
                'revshare_percent' => $rate,
                'fixed_payout_usd' => (float)($o['fixed_payout_usd'] ?? 0),
                'currency' => $o['currency'] ?? 'USD',
                'status' => $o['status'] ?? 'active'
            ];
        }, $rawOffers);

        respondJson(['success' => true, 'data' => $offers]);
        break;

    case 'generate-tracking-link':
        $user = getAuthenticatedUser();
        if (!$user) {
            respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
        }

        $affInfo = ensureUserAffiliateId($db, $user);
        $affId = $affInfo['affiliate_id'];

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $offerId = trim($input['offer_id'] ?? 'offer_main_saas');
        $subId1 = trim($input['sub_id1'] ?? '');
        $subId2 = trim($input['sub_id2'] ?? '');

        $baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $trackUrl = $baseUrl . '/track?aff_id=' . urlencode($affId) . '&offer_id=' . urlencode($offerId);
        if ($subId1) $trackUrl .= '&sub_id1=' . urlencode($subId1);
        if ($subId2) $trackUrl .= '&sub_id2=' . urlencode($subId2);

        // Store custom tracking link
        $linkId = 'link_' . bin2hex(random_bytes(6));
        try {
            $stmt = $db->prepare("INSERT INTO affiliate_tracking_links (id, user_id, affiliate_id, offer_id, slug, sub_id1, sub_id2, full_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([$linkId, $user['id'], $affId, $offerId, $subId1 ?: $offerId, $subId1, $subId2, $trackUrl]);
        } catch (Throwable $e) {}

        respondJson([
            'success' => true,
            'data' => [
                'trackingUrl' => $trackUrl,
                'affiliateId' => $affId,
                'offerId' => $offerId
            ]
        ]);
        break;

    case 'save-postback-config':
        $user = getAuthenticatedUser();
        if (!$user) {
            respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
        }

        $affInfo = ensureUserAffiliateId($db, $user);
        $affId = $affInfo['affiliate_id'];

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $postbackUrl = trim($input['postback_url'] ?? '');
        $httpMethod = strtoupper(trim($input['http_method'] ?? 'GET'));
        if (!in_array($httpMethod, ['GET', 'POST'])) $httpMethod = 'GET';
        $isActive = isset($input['is_active']) ? (int)(bool)$input['is_active'] : 1;

        if (!empty($postbackUrl) && !filter_var(preg_replace('/\{[A-Z0-9_]+\}/', 'TEST', $postbackUrl), FILTER_VALIDATE_URL)) {
            respondJson(['success' => false, 'error' => 'Invalid Postback URL format.'], 400);
        }

        $configId = 'pbc_' . bin2hex(random_bytes(6));
        $stmt = $db->prepare("
            INSERT INTO affiliate_postback_configs (id, user_id, affiliate_id, postback_url, http_method, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE postback_url = VALUES(postback_url), http_method = VALUES(http_method), is_active = VALUES(is_active), updated_at = NOW()
        ");
        $stmt->execute([$configId, $user['id'], $affId, $postbackUrl, $httpMethod, $isActive]);

        respondJson(['success' => true, 'message' => 'Postback webhook configuration saved successfully.']);
        break;

    case 'request-withdrawal':
        $user = getAuthenticatedUser();
        if (!$user) {
            respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $amount = (float)($input['amount'] ?? 0);
        $payoutMethod = trim($input['payout_method'] ?? 'crypto');
        $details = $input['payout_details'] ?? [];

        // Fetch Min Payout Limit
        $stmtSet = $db->prepare("SELECT `value` FROM settings WHERE `key` = 'affiliate_min_payout_usd'");
        $stmtSet->execute();
        $minLimit = (float)($stmtSet->fetchColumn() ?: 50.0);

        if ($amount < $minLimit) {
            respondJson(['success' => false, 'error' => "Minimum payout threshold is \${$minLimit} USD."], 400);
        }

        // Calculate available balance
        $affInfo = ensureUserAffiliateId($db, $user);
        $affId = $affInfo['affiliate_id'];

        $stmtConv = $db->prepare("SELECT COALESCE(SUM(payout_amount), 0) FROM affiliate_conversions WHERE affiliate_id = ? AND status = 'approved'");
        $stmtConv->execute([$affId]);
        $totalEarned = (float)$stmtConv->fetchColumn();

        $stmtPaid = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM affiliate_withdrawals WHERE user_id = ? AND status IN ('pending', 'approved', 'processing', 'paid')");
        $stmtPaid->execute([$user['id']]);
        $committed = (float)$stmtPaid->fetchColumn();

        $available = max(0, $totalEarned - $committed);

        if ($amount > $available) {
            respondJson(['success' => false, 'error' => "Insufficient available balance. You have \${$available} USD available."], 400);
        }

        $withKey = 'wth_' . bin2hex(random_bytes(8));
        $stmtIns = $db->prepare("
            INSERT INTO affiliate_withdrawals (id, user_id, amount, payout_method, payout_details_json, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())
        ");
        $stmtIns->execute([$withKey, $user['id'], $amount, $payoutMethod, json_encode($details)]);

        // Audit log
        try {
            $auditId = 'aud_' . bin2hex(random_bytes(6));
            $stmtAud = $db->prepare("INSERT INTO affiliate_audit_logs (id, action_type, target_type, target_id, actor_id, details_json, created_at) VALUES (?, 'withdrawal_request', 'withdrawal', ?, ?, ?, NOW())");
            $stmtAud->execute([$auditId, $withKey, $user['id'], json_encode(['amount' => $amount, 'method' => $payoutMethod])]);
        } catch (Throwable $e) {}

        respondJson(['success' => true, 'message' => "Withdrawal request for \${$amount} USD submitted successfully."]);
        break;

    // ──────────────────────────────────────────────
    // ADMIN CONTROL ENDPOINTS
    // ──────────────────────────────────────────────

    case 'admin-get-overview':
        $admin = requireAdmin();

        // 1. Total Affiliates (All registered platform users)
        $stmtAff = $db->prepare("SELECT COUNT(*) as total, COUNT(CASE WHEN COALESCE(affiliate_status, 'active') = 'active' THEN 1 END) as active FROM users");
        $stmtAff->execute();
        $affCounts = $stmtAff->fetch(PDO::FETCH_ASSOC);

        // 2. Total Clicks & Conversions
        $stmtClk = $db->prepare("SELECT COUNT(*) as total_clicks FROM affiliate_clicks");
        $stmtClk->execute();
        $totalClicks = (int)$stmtClk->fetchColumn();

        $stmtCnv = $db->prepare("SELECT COUNT(*) as total_conversions, COALESCE(SUM(payout_amount), 0) as total_payouts, COALESCE(SUM(order_amount), 0) as total_revenue FROM affiliate_conversions WHERE status = 'approved'");
        $stmtCnv->execute();
        $convTotals = $stmtCnv->fetch(PDO::FETCH_ASSOC);

        // 3. Pending Withdrawals
        $stmtWith = $db->prepare("SELECT COUNT(*) as pending_count, COALESCE(SUM(amount), 0) as pending_amount FROM affiliate_withdrawals WHERE status IN ('pending', 'approved', 'processing')");
        $stmtWith->execute();
        $pendingWith = $stmtWith->fetch(PDO::FETCH_ASSOC);

        // 4. Settled Paid
        $stmtPaid = $db->prepare("SELECT COALESCE(SUM(amount), 0) as paid_amount FROM affiliate_withdrawals WHERE status = 'paid'");
        $stmtPaid->execute();
        $totalPaidOut = (float)$stmtPaid->fetchColumn();

        // 5. System Settings
        $stmtSet = $db->prepare("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'affiliate_%'");
        $stmtSet->execute();
        $settings = [];
        foreach ($stmtSet->fetchAll(PDO::FETCH_ASSOC) as $s) {
            $settings[$s['key']] = $s['value'];
        }

        respondJson([
            'success' => true,
            'data' => [
                'totalAffiliates' => (int)($affCounts['total'] ?? 0),
                'activeAffiliates' => (int)($affCounts['active'] ?? 0),
                'totalClicks' => $totalClicks,
                'totalConversions' => (int)($convTotals['total_conversions'] ?? 0),
                'totalRevenue' => round((float)($convTotals['total_revenue'] ?? 0), 2),
                'totalCommissionGenerated' => round((float)($convTotals['total_payouts'] ?? 0), 2),
                'totalPaidOut' => round($totalPaidOut, 2),
                'pendingWithdrawalsCount' => (int)($pendingWith['pending_count'] ?? 0),
                'pendingWithdrawalsAmount' => round((float)($pendingWith['pending_amount'] ?? 0), 2),
                'conversionRate' => $totalClicks > 0 ? round(((int)($convTotals['total_conversions'] ?? 0) / $totalClicks) * 100, 2) : 0,
                'settings' => [
                    'enabled' => ($settings['affiliate_system_enabled'] ?? '1') === '1',
                    'defaultRate' => (float)($settings['affiliate_default_commission_rate'] ?? 15),
                    'minPayout' => (float)($settings['affiliate_min_payout_usd'] ?? 50),
                    'cookieDays' => (int)($settings['affiliate_cookie_duration_days'] ?? 30)
                ]
            ]
        ]);
        break;

    case 'admin-get-affiliates':
        $admin = requireAdmin();

        $search = trim($_GET['search'] ?? '');
        $status = trim($_GET['status'] ?? '');

        // Auto-provision missing affiliate IDs
        try {
            $missingSt = $db->query("SELECT id, name, email, affiliate_id, referral_code FROM users WHERE affiliate_id IS NULL OR referral_code IS NULL OR affiliate_id LIKE '%_' OR referral_code LIKE '%_'");
            if ($missingSt) {
                while ($mRow = $missingSt->fetch(PDO::FETCH_ASSOC)) {
                    ensureUserAffiliateId($db, $mRow);
                }
            }
        } catch (Throwable $e) {}

        $sql = "
            SELECT u.id, u.name, u.email, 
                   COALESCE(u.affiliate_id, CONCAT('AFF-', UPPER(SUBSTRING(REPLACE(u.id, 'usr_', ''), 1, 6)))) as affiliate_id, 
                   COALESCE(u.referral_code, CONCAT('REF_', UPPER(SUBSTRING(REPLACE(u.id, 'usr_', ''), 1, 6)))) as referral_code, 
                   COALESCE(u.affiliate_status, 'active') as affiliate_status, 
                   u.created_at,
                   COUNT(DISTINCT c.id) as total_clicks,
                   COUNT(DISTINCT v.id) as total_conversions,
                   COALESCE(SUM(DISTINCT v.payout_amount), 0) as total_earnings
            FROM users u
            LEFT JOIN affiliate_clicks c ON c.affiliate_id = u.affiliate_id
            LEFT JOIN affiliate_conversions v ON v.affiliate_id = u.affiliate_id AND v.status = 'approved'
            WHERE 1=1
        ";
        $params = [];

        if ($search) {
            $sql .= " AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.affiliate_id) LIKE ?)";
            $params[] = '%' . strtolower($search) . '%';
            $params[] = '%' . strtolower($search) . '%';
            $params[] = '%' . strtolower($search) . '%';
        }
        if ($status) {
            $sql .= " AND COALESCE(u.affiliate_status, 'active') = ?";
            $params[] = $status;
        }

        $sql .= " GROUP BY u.id ORDER BY u.created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $affiliates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respondJson(['success' => true, 'data' => $affiliates]);
        break;

    case 'admin-update-affiliate-status':
        $admin = requireAdmin();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $affId = trim($input['affiliate_id'] ?? '');
        $newStatus = strtolower(trim($input['status'] ?? ''));

        if (!in_array($newStatus, ['active', 'suspended', 'disabled'])) {
            respondJson(['success' => false, 'error' => 'Invalid status value.'], 400);
        }

        $stmt = $db->prepare("UPDATE users SET affiliate_status = ? WHERE affiliate_id = ?");
        $stmt->execute([$newStatus, $affId]);

        // Audit Log
        try {
            $auditId = 'aud_' . bin2hex(random_bytes(6));
            $stmtAud = $db->prepare("INSERT INTO affiliate_audit_logs (id, action_type, target_type, target_id, actor_id, details_json, created_at) VALUES (?, 'affiliate_status_change', 'affiliate', ?, ?, ?, NOW())");
            $stmtAud->execute([$auditId, $affId, $admin['id'], json_encode(['status' => $newStatus])]);
        } catch (Throwable $e) {}

        respondJson(['success' => true, 'message' => "Affiliate {$affId} status updated to {$newStatus}."]);
        break;

    case 'admin-get-offers':
        $admin = requireAdmin();

        $stmt = $db->prepare("SELECT * FROM affiliate_offers ORDER BY created_at ASC");
        $stmt->execute();
        $offers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respondJson(['success' => true, 'data' => $offers]);
        break;

    case 'admin-save-offer':
        $admin = requireAdmin();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $offerId = trim($input['id'] ?? '');
        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $targetUrl = trim($input['target_url'] ?? '');
        $payoutType = in_array($input['payout_type'] ?? '', ['fixed', 'revshare']) ? $input['payout_type'] : 'revshare';
        $revsharePercent = (float)($input['revshare_percent'] ?? 15.0);
        $fixedPayoutUsd = (float)($input['fixed_payout_usd'] ?? 0.0);
        $status = in_array($input['status'] ?? '', ['active', 'paused', 'archived']) ? $input['status'] : 'active';

        if (!$title || !$targetUrl) {
            respondJson(['success' => false, 'error' => 'Title and Target URL are required.'], 400);
        }

        if (empty($offerId)) {
            $offerId = 'offer_' . bin2hex(random_bytes(6));
        }

        $stmt = $db->prepare("
            INSERT INTO affiliate_offers (id, title, description, target_url, payout_type, revshare_percent, fixed_payout_usd, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), target_url = VALUES(target_url), payout_type = VALUES(payout_type), revshare_percent = VALUES(revshare_percent), fixed_payout_usd = VALUES(fixed_payout_usd), status = VALUES(status), updated_at = NOW()
        ");
        $stmt->execute([$offerId, $title, $description, $targetUrl, $payoutType, $revsharePercent, $fixedPayoutUsd, $status]);

        // Real-time broadcast to all connected desktop software instances
        try {
            $evStmt = $db->prepare("
                INSERT INTO realtime_sync_events (event_id, event_type, target_user_id, payload)
                VALUES (?, 'affiliate.offer.updated', NULL, ?)
            ");
            $evStmt->execute([
                'evt_' . uniqid(),
                json_encode([
                    'id' => $offerId,
                    'title' => $title,
                    'description' => $description,
                    'target_url' => $targetUrl,
                    'payout_type' => $payoutType,
                    'revshare_percent' => $revsharePercent,
                    'commission_rate' => $revsharePercent,
                    'fixed_payout_usd' => $fixedPayoutUsd,
                    'status' => $status,
                    'timestamp' => time()
                ])
            ]);
        } catch (Throwable $e) {}

        respondJson(['success' => true, 'message' => "Offer '{$title}' saved successfully.", 'data' => ['id' => $offerId, 'title' => $title, 'status' => $status]]);
        break;

    case 'admin-delete-offer':
        $admin = requireAdmin();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $offerId = trim($input['id'] ?? $input['offer_id'] ?? '');
        if (!$offerId) {
            respondJson(['success' => false, 'error' => 'Offer ID is required.'], 400);
        }
        $stmt = $db->prepare("UPDATE affiliate_offers SET status = 'archived', updated_at = NOW() WHERE id = ?");
        $stmt->execute([$offerId]);

        // Real-time broadcast to all connected desktop software instances
        try {
            $evStmt = $db->prepare("
                INSERT INTO realtime_sync_events (event_id, event_type, target_user_id, payload)
                VALUES (?, 'affiliate.offer.deleted', NULL, ?)
            ");
            $evStmt->execute([
                'evt_' . uniqid(),
                json_encode(['id' => $offerId, 'status' => 'archived', 'timestamp' => time()])
            ]);
        } catch (Throwable $e) {}

        respondJson(['success' => true, 'message' => 'Offer archived successfully.']);
        break;

    case 'get-clicks':
        $user = getAuthenticatedUser();
        if (!$user) {
            respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
        }
        $affInfo = ensureUserAffiliateId($db, $user);
        $affId = $affInfo['affiliate_id'];
        $refCode = $affInfo['referral_code'];
        $cleanSuffix = preg_replace('/^(REF_|AFF-)/i', '', $refCode);
        $searchAffIds = array_values(array_unique(array_filter([
            $affId, 
            $refCode, 
            $cleanSuffix, 
            'REF_' . $cleanSuffix, 
            'AFF-' . $cleanSuffix, 
            $user['id']
        ])));
        $inPlaceholders = implode(',', array_fill(0, count($searchAffIds), '?'));

        $stmt = $db->prepare("
            SELECT c.*, o.title as offer_title 
            FROM affiliate_clicks c 
            LEFT JOIN affiliate_offers o ON o.id = c.offer_id 
            WHERE c.affiliate_id IN ($inPlaceholders) 
            ORDER BY c.created_at DESC 
            LIMIT 100
        ");
        $stmt->execute($searchAffIds);
        $clicks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respondJson(['success' => true, 'data' => $clicks]);
        break;

    case 'simulate-test-click':
    case 'admin-record-test-click':
        $user = getAuthenticatedUser();
        $targetAffId = trim($input['affiliate_id'] ?? $input['aff_id'] ?? $input['ref'] ?? '');
        
        if (empty($targetAffId) && $user) {
            $affInfo = ensureUserAffiliateId($db, $user);
            $targetAffId = $affInfo['affiliate_id'];
        }
        if (empty($targetAffId)) {
            $targetAffId = 'AFF-28DE2A';
        }

        $targetOfferId = trim($input['offer_id'] ?? 'offer_main_saas');
        $sub1 = trim($input['sub_id1'] ?? 'test_live_stream');
        
        $testClickId = 'clk_test_' . round(microtime(true) * 1000) . '_' . substr(bin2hex(random_bytes(3)), 0, 6);
        $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

        try {
            $stmtClick = $db->prepare("
                INSERT INTO affiliate_clicks (
                    click_id, affiliate_id, offer_id, ip_address, user_agent, referrer, landing_url,
                    sub_id1, created_at
                ) VALUES (
                    ?, ?, ?, ?, ?, 'https://antiprofiles.com/referral-test', 'https://antiprofiles.com/register?ref=' || ?,
                    ?, CURRENT_TIMESTAMP
                )
            ");
            $stmtClick->execute([
                $testClickId, $targetAffId, $targetOfferId, $ip, $ua, $targetAffId, $sub1
            ]);
        } catch (Throwable $e) {
            try {
                $stmtClick2 = $db->prepare("
                    INSERT INTO affiliate_clicks (
                        click_id, affiliate_id, offer_id, ip_address, user_agent, referrer, created_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, 'https://antiprofiles.com/referral-test', CURRENT_TIMESTAMP
                    )
                ");
                $stmtClick2->execute([$testClickId, $targetAffId, $targetOfferId, $ip, $ua]);
            } catch (Throwable $e2) {}
        }

        // Increment offer count
        try {
            $db->prepare("UPDATE affiliate_offers SET total_clicks = total_clicks + 1 WHERE id = ?")->execute([$targetOfferId]);
        } catch (Throwable $e) {}

        respondJson([
            'success' => true,
            'message' => "Simulated live click generated successfully for {$targetAffId}!",
            'data' => [
                'click_id' => $testClickId,
                'affiliate_id' => $targetAffId,
                'offer_id' => $targetOfferId,
                'ip_address' => $ip,
                'sub_id1' => $sub1,
                'created_at' => date('Y-m-d H:i:s')
            ]
        ]);
        break;

    case 'admin-get-clicks':
        $admin = requireAdmin();

        $stmt = $db->prepare("
            SELECT c.*, o.title as offer_title, u.name as affiliate_name, u.email as affiliate_email 
            FROM affiliate_clicks c 
            LEFT JOIN affiliate_offers o ON o.id = c.offer_id 
            LEFT JOIN users u ON (u.affiliate_id = c.affiliate_id OR u.referral_code = c.affiliate_id OR u.id = c.affiliate_id)
            ORDER BY c.created_at DESC 
            LIMIT 150
        ");
        $stmt->execute();
        $clicks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respondJson(['success' => true, 'data' => $clicks]);
        break;

    case 'admin-get-conversions':
        $admin = requireAdmin();

        $stmt = $db->prepare("
            SELECT v.*, u.email as affiliate_email, o.title as offer_title
            FROM affiliate_conversions v
            LEFT JOIN users u ON u.affiliate_id = v.affiliate_id
            LEFT JOIN affiliate_offers o ON o.id = v.offer_id
            ORDER BY v.created_at DESC
            LIMIT 100
        ");
        $stmt->execute();
        $conversions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respondJson(['success' => true, 'data' => $conversions]);
        break;

    case 'admin-get-postbacks':
        $admin = requireAdmin();

        $stmtConfigs = $db->prepare("
            SELECT p.*, u.name as user_name, u.email as user_email
            FROM affiliate_postback_configs p
            LEFT JOIN users u ON u.id = p.user_id
            ORDER BY p.updated_at DESC
        ");
        $stmtConfigs->execute();
        $configs = $stmtConfigs->fetchAll(PDO::FETCH_ASSOC);

        $stmtLogs = $db->prepare("
            SELECT p.*, u.email as affiliate_email
            FROM affiliate_postbacks p
            LEFT JOIN users u ON u.affiliate_id = p.affiliate_id
            ORDER BY p.created_at DESC
            LIMIT 100
        ");
        $stmtLogs->execute();
        $postbacks = $stmtLogs->fetchAll(PDO::FETCH_ASSOC);

        respondJson(['success' => true, 'configs' => $configs, 'data' => $postbacks]);
        break;

    case 'admin-get-postback-configs':
        $admin = requireAdmin();
        $stmt = $db->prepare("
            SELECT p.*, u.name as user_name, u.email as user_email
            FROM affiliate_postback_configs p
            LEFT JOIN users u ON u.id = p.user_id
            ORDER BY p.updated_at DESC
        ");
        $stmt->execute();
        $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respondJson(['success' => true, 'data' => $configs]);
        break;

    case 'admin-save-postback-config':
        $admin = requireAdmin();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $userId = trim($input['user_id'] ?? '');
        $postbackUrl = trim($input['postback_url'] ?? '');
        $httpMethod = strtoupper(trim($input['http_method'] ?? 'GET'));
        if (!in_array($httpMethod, ['GET', 'POST'])) $httpMethod = 'GET';
        $isActive = isset($input['is_active']) ? ($input['is_active'] ? 1 : 0) : 1;

        if (empty($userId)) {
            respondJson(['success' => false, 'error' => 'User ID is required.'], 400);
        }

        // Get user affiliate ID
        $uStmt = $db->prepare("SELECT id, affiliate_id FROM users WHERE id = ?");
        $uStmt->execute([$userId]);
        $targetUser = $uStmt->fetch(PDO::FETCH_ASSOC);
        if (!$targetUser) {
            respondJson(['success' => false, 'error' => 'Target user not found.'], 404);
        }

        $affId = $targetUser['affiliate_id'] ?: 'AFF-' . strtoupper(substr(md5($userId), 0, 6));
        $configId = 'pbcfg_' . bin2hex(random_bytes(8));

        $stmt = $db->prepare("
            INSERT INTO affiliate_postback_configs (id, user_id, affiliate_id, postback_url, http_method, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE postback_url = VALUES(postback_url), http_method = VALUES(http_method), is_active = VALUES(is_active), updated_at = NOW()
        ");
        $stmt->execute([$configId, $userId, $affId, $postbackUrl, $httpMethod, $isActive]);

        respondJson(['success' => true, 'message' => 'S2S Postback configuration updated successfully.']);
        break;

    case 'admin-test-postback':
        $admin = requireAdmin();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $postbackUrl = trim($input['postback_url'] ?? '');
        $httpMethod = strtoupper(trim($input['http_method'] ?? 'GET'));

        if (empty($postbackUrl)) {
            respondJson(['success' => false, 'error' => 'Postback URL is required.'], 400);
        }

        $renderedUrl = str_replace(
            ['{CLICK_ID}', '{AFFILIATE_ID}', '{OFFER_ID}', '{CONVERSION_ID}', '{STATUS}', '{PAYOUT}', '{COMMISSION}', '{AMOUNT}'],
            ['test_click_123456', 'AFF-TEST', 'offer_main_saas', 'test_conv_987654', 'approved', '15.00', '15.00', '100.00'],
            $postbackUrl
        );

        $start = microtime(true);
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $renderedUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        if ($httpMethod === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['event' => 'test_ping', 'click_id' => 'test_click_123456', 'payout' => 15.00]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        $elapsed = round((microtime(true) - $start) * 1000);
        respondJson([
            'success' => true,
            'data' => [
                'statusCode' => $code ?: 0,
                'responseTimeMs' => $elapsed,
                'error' => $err ?: null
            ]
        ]);
        break;

    case 'admin-retry-postback':
        $admin = requireAdmin();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $postbackId = trim($input['postback_id'] ?? '');

        $stmt = $db->prepare("SELECT * FROM affiliate_postbacks WHERE id = ?");
        $stmt->execute([$postbackId]);
        $pb = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$pb) {
            respondJson(['success' => false, 'error' => 'Postback record not found.'], 404);
        }

        // Fire cURL
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $pb['url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        if ($pb['http_method'] === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $pb['request_payload'] ?? '');
        }

        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $status = ($code >= 200 && $code < 300) ? 'delivered' : 'failed';
        $up = $db->prepare("UPDATE affiliate_postbacks SET http_status = ?, response_body = ?, status = ?, retry_count = retry_count + 1, updated_at = NOW() WHERE id = ?");
        $up->execute([$code, substr($resp ?: '', 0, 500), $status, $postbackId]);

        respondJson(['success' => true, 'message' => "Postback redelivered with HTTP {$code}."]);
        break;

    case 'admin-get-withdrawals':
        $admin = requireAdmin();

        $statusFilter = trim($_GET['status'] ?? '');
        $sql = "
            SELECT w.*, u.name as user_name, u.email as user_email, u.affiliate_id
            FROM affiliate_withdrawals w
            JOIN users u ON u.id = w.user_id
            WHERE 1=1
        ";
        $params = [];
        if ($statusFilter) {
            $sql .= " AND w.status = ?";
            $params[] = $statusFilter;
        }
        $sql .= " ORDER BY w.created_at DESC LIMIT 100";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $withdrawals = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respondJson(['success' => true, 'data' => $withdrawals]);
        break;

    case 'admin-update-withdrawal':
        $admin = requireAdmin();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $id = trim($input['id'] ?? '');
        $status = strtolower(trim($input['status'] ?? ''));
        $note = trim($input['admin_note'] ?? '');
        $payoutRef = trim($input['payout_reference'] ?? '');

        if (!in_array($status, ['pending', 'approved', 'processing', 'paid', 'rejected', 'failed', 'cancelled'])) {
            respondJson(['success' => false, 'error' => 'Invalid status transition.'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM affiliate_withdrawals WHERE id = ?");
        $stmt->execute([$id]);
        $with = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$with) {
            respondJson(['success' => false, 'error' => 'Withdrawal record not found.'], 404);
        }

        // Duplicate settlement prevention
        if ($with['status'] === 'paid' && $status === 'paid') {
            respondJson(['success' => false, 'error' => 'This withdrawal has already been settled and marked as Paid.'], 400);
        }

        $up = $db->prepare("
            UPDATE affiliate_withdrawals 
            SET status = ?, admin_note = ?, payout_reference = COALESCE(NULLIF(?, ''), payout_reference), processed_by = ?, updated_at = NOW() 
            WHERE id = ?
        ");
        $up->execute([$status, $note, $payoutRef, $admin['id'], $id]);

        // Audit log
        try {
            $auditId = 'aud_' . bin2hex(random_bytes(6));
            $stmtAud = $db->prepare("INSERT INTO affiliate_audit_logs (id, action_type, target_type, target_id, actor_id, details_json, created_at) VALUES (?, 'withdrawal_status_change', 'withdrawal', ?, ?, ?, NOW())");
            $stmtAud->execute([$auditId, $id, $admin['id'], json_encode(['from' => $with['status'], 'to' => $status, 'ref' => $payoutRef])]);
        } catch (Throwable $e) {}

        respondJson(['success' => true, 'message' => "Withdrawal {$id} updated to {$status}."]);
        break;

    case 'admin-save-settings':
        $admin = requireAdmin();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $enabled = isset($input['enabled']) ? ($input['enabled'] ? '1' : '0') : '1';
        $defaultRate = (float)($input['default_commission_rate'] ?? 15.0);
        $minPayout = (float)($input['min_payout_usd'] ?? 50.0);
        $cookieDays = (int)($input['cookie_duration_days'] ?? 30);

        $settings = [
            'affiliate_system_enabled' => $enabled,
            'affiliate_default_commission_rate' => (string)$defaultRate,
            'affiliate_min_payout_usd' => (string)$minPayout,
            'affiliate_cookie_duration_days' => (string)$cookieDays
        ];

        foreach ($settings as $k => $v) {
            $stmt = $db->prepare("INSERT INTO settings (`key`, `value`, `updated_at`) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()");
            $stmt->execute([$k, $v]);
        }

        respondJson(['success' => true, 'message' => 'Affiliate global system settings saved successfully.']);
        break;

    default:
        respondJson(['success' => false, 'error' => "Unknown action '{$action}'."], 404);
}
