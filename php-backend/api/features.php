<?php
// ──────────────────────────────────────────────
// AntiProfiles — Dynamic Software Feature Management API
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

sendJsonHeader();

$db = Database::getConnection();
ensureDatabaseTablesExist();
ensureDefaultSoftwareFeaturesSeeded($db);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

if ($method === 'GET') {
    $category = $_GET['category'] ?? null;
    $search = $_GET['search'] ?? null;
    $showAll = isset($_GET['all']) && ($_GET['all'] == '1' || $_GET['all'] === 'true');
    
    // Check if user is admin when showAll is requested
    $enabledOnly = !$showAll;
    if ($showAll) {
        $user = getAuthenticatedUser();
        $isAdmin = false;
        if ($user) {
            $lowerEmail = strtolower(trim($user['email'] ?? ''));
            $userRole = strtolower(trim($user['role'] ?? 'user'));
            $isAdmin = ($userRole === 'admin' || $userRole === 'super_admin' || $userRole === 'administrator' || $userRole === 'owner' ||
                $lowerEmail === 'edge@gmail.com' || strpos($lowerEmail, 'admin') !== false || strpos($lowerEmail, 'mizanur') !== false);
        }
        if (!$isAdmin) {
            $enabledOnly = true; // Fallback to enabled only for public
        }
    }

    $features = getAllSoftwareFeatures($db, $category, $enabledOnly, $search);
    $categories = getSoftwareFeatureCategories($db);

    $totalEnabled = 0;
    $totalCount = 0;
    foreach ($categories as $cat) {
        $totalCount += (int)($cat['total_count'] ?? 0);
        $totalEnabled += (int)($cat['enabled_count'] ?? 0);
    }

    respondJson([
        'success' => true,
        'count' => count($features),
        'total_features' => $totalCount,
        'enabled_features' => $totalEnabled,
        'categories' => $categories,
        'features' => $features
    ]);
}

if ($method === 'POST') {
    $user = requireAdmin();
    $rawInput = file_get_contents('php://input');
    $data = [];
    if (!empty($rawInput)) {
        $json = json_decode($rawInput, true);
        if (is_array($json)) {
            $data = $json;
        }
    }
    if (empty($data)) {
        $data = $_POST;
    }

    $postAction = $data['action'] ?? $action;

    if ($postAction === 'save' || $postAction === 'create' || $postAction === 'update') {
        $res = saveSoftwareFeature($db, $data);
        if ($res['success']) {
            respondJson([
                'success' => true,
                'message' => $res['message'],
                'feature_id' => $res['id']
            ]);
        } else {
            respondJson(['success' => false, 'error' => $res['error'] ?? 'Failed to save feature.'], 400);
        }
    }

    if ($postAction === 'toggle') {
        $id = trim($data['id'] ?? '');
        if (empty($id)) {
            respondJson(['success' => false, 'error' => 'Feature ID is required.'], 400);
        }
        $isEnabled = isset($data['is_enabled']) ? (bool)$data['is_enabled'] : null;
        $success = toggleSoftwareFeature($db, $id, $isEnabled);
        respondJson([
            'success' => $success,
            'message' => $success ? 'Feature visibility updated.' : 'Failed to update feature.'
        ]);
    }

    if ($postAction === 'delete') {
        $id = trim($data['id'] ?? '');
        if (empty($id)) {
            respondJson(['success' => false, 'error' => 'Feature ID is required.'], 400);
        }
        $success = deleteSoftwareFeature($db, $id);
        respondJson([
            'success' => $success,
            'message' => $success ? 'Feature removed successfully.' : 'Failed to delete feature.'
        ]);
    }

    if ($postAction === 'reset_defaults' || $postAction === 'restore_all') {
        $success = resetAllSoftwareFeaturesToDefault($db);
        respondJson([
            'success' => $success,
            'message' => $success ? 'All 52 default features have been restored successfully.' : 'Failed to reset features.'
        ]);
    }

    if ($postAction === 'reorder') {
        $orderList = $data['order'] ?? [];
        if (is_array($orderList)) {
            $stmt = $db->prepare("UPDATE software_features SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
            foreach ($orderList as $idx => $fId) {
                $stmt->execute([($idx + 1) * 10, $fId]);
            }
            respondJson(['success' => true, 'message' => 'Sort order updated successfully.']);
        }
        respondJson(['success' => false, 'error' => 'Invalid order array.'], 400);
    }

    respondJson(['success' => false, 'error' => 'Invalid action.'], 400);
}

respondJson(['success' => false, 'error' => 'Method not allowed.'], 405);
