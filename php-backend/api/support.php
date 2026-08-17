<?php
// ──────────────────────────────────────────────
// ProfileVault — Live Support REST API (PHP Backend)
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

sendJsonHeader();
$user = getAuthenticatedUser();
if (!$user) {
    respondJson(['success' => false, 'error' => 'Authentication required.'], 401);
}

$db = Database::getConnection();
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

switch ($action) {
    // 1. Get User Support Conversations
    case 'user-conversations':
        $stmt = $db->prepare("
            SELECT 
                c.*,
                (SELECT message FROM support_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview,
                (SELECT COUNT(*) FROM support_messages WHERE conversation_id = c.id AND sender_type != 'user' AND is_read = 0) as unread_count
            FROM support_conversations c
            WHERE c.user_id = ?
            ORDER BY c.last_message_at DESC
        ");
        $stmt->execute([$user['id']]);
        respondJson(['success' => true, 'data' => $stmt->fetchAll()]);
        break;

    // 2. Get Single Conversation Details
    case 'conversation':
        $convId = $_GET['id'] ?? $input['conversation_id'] ?? '';
        if (!$convId) respondJson(['success' => false, 'error' => 'Conversation ID required.'], 400);

        $stmt = $db->prepare("
            SELECT 
                c.*,
                COALESCE(u.name, c.user_id, 'Visitor Guest') as user_name,
                COALESCE(u.email, 'guest@profilevault.local') as user_email,
                COALESCE(u.account_status, 'active') as user_status,
                COALESCE(u.created_at, c.created_at) as user_created_at,
                (SELECT name FROM users WHERE id = c.assigned_agent_id) as assigned_agent_name,
                (SELECT p.name FROM subscriptions s JOIN pricing_plans p ON s.plan_id = p.id WHERE s.user_id = c.user_id) as user_plan
            FROM support_conversations c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        ");
        $stmt->execute([$convId]);
        $conv = $stmt->fetch();
        if (!$conv) respondJson(['success' => false, 'error' => 'Conversation not found.'], 404);

        if ($user['role'] !== 'admin' && $conv['user_id'] !== $user['id']) {
            respondJson(['success' => false, 'error' => 'Access denied.'], 403);
        }

        $msgStmt = $db->prepare("
            SELECT m.*, u.name as sender_name 
            FROM support_messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC
        ");
        $msgStmt->execute([$convId]);
        $conv['messages'] = $msgStmt->fetchAll();

        if ($user['role'] === 'admin') {
            $noteStmt = $db->prepare("
                SELECT * FROM support_internal_notes 
                WHERE conversation_id = ?
                ORDER BY created_at ASC
            ");
            $noteStmt->execute([$convId]);
            $conv['internal_notes'] = $noteStmt->fetchAll();
        } else {
            $conv['internal_notes'] = [];
        }

        respondJson(['success' => true, 'data' => $conv]);
        break;

    // 3. Create Support Conversation
    case 'create-conversation':
        $subject = trim($input['subject'] ?? 'Support Request');
        $initialMessage = trim($input['initialMessage'] ?? $input['message'] ?? '');
        $priority = $input['priority'] ?? 'normal';

        if (!$initialMessage) {
            respondJson(['success' => false, 'error' => 'Initial message body is required.'], 400);
        }

        $convId = 'conv_' . bin2hex(random_bytes(8));
        $msgId = 'msg_' . bin2hex(random_bytes(8));

        try {
            $userStmt = $db->prepare("INSERT IGNORE INTO users (id, name, email, role, email_verified, account_status) VALUES (?, 'Visitor Guest', ?, 'user', 1, 'active')");
            $userStmt->execute([$user['id'], $user['email'] ?? ($user['id'] . '@guest.profilevault.local')]);
        } catch (Exception $e) {}

        $stmt = $db->prepare("
            INSERT INTO support_conversations (id, user_id, status, priority, subject, last_message_at, created_at)
            VALUES (?, ?, 'open', ?, ?, NOW(), NOW())
        ");
        $stmt->execute([$convId, $user['id'], $priority, $subject]);

        $msgStmt = $db->prepare("
            INSERT INTO support_messages (id, conversation_id, sender_id, sender_type, message, message_type, created_at)
            VALUES (?, ?, ?, 'user', ?, 'text', NOW())
        ");
        $msgStmt->execute([$msgId, $convId, $user['id'], $initialMessage]);

        // Auto-reply
        $autoRow = $db->query("SELECT value FROM support_settings WHERE `key` = 'auto_reply_message'")->fetch();
        $autoEnabled = $db->query("SELECT value FROM support_settings WHERE `key` = 'auto_reply_enabled'")->fetch();
        if ($autoEnabled && $autoEnabled['value'] === 'true' && $autoRow && !empty($autoRow['value'])) {
            $autoMsgId = 'msg_auto_' . bin2hex(random_bytes(8));
            $db->prepare("
                INSERT INTO support_messages (id, conversation_id, sender_id, sender_type, message, message_type, created_at)
                VALUES (?, ?, 'system', 'agent', ?, 'text', DATE_ADD(NOW(), INTERVAL 1 SECOND))
            ")->execute([$autoMsgId, $convId, $autoRow['value']]);
        }

        respondJson(['success' => true, 'data' => ['id' => $convId, 'subject' => $subject, 'status' => 'open'], 'conversation_id' => $convId]);
        break;

    // 4. Send Support Message
    case 'send-message':
        $convId = $input['conversation_id'] ?? '';
        $messageText = trim($input['message'] ?? '');
        if (!$convId || !$messageText) {
            respondJson(['success' => false, 'error' => 'Conversation ID and message are required.'], 400);
        }

        $senderType = $user['role'] === 'admin' ? 'agent' : 'user';
        $msgId = 'msg_' . bin2hex(random_bytes(8));

        $db->prepare("
            INSERT INTO support_messages (id, conversation_id, sender_id, sender_type, message, message_type, created_at)
            VALUES (?, ?, ?, ?, ?, 'text', NOW())
        ")->execute([$msgId, $convId, $user['id'], $senderType, $messageText]);

        $newStatus = $senderType === 'user' ? 'waiting_support' : 'waiting_user';
        $db->prepare("
            UPDATE support_conversations 
            SET status = ?, last_message_at = NOW() 
            WHERE id = ?
        ")->execute([$newStatus, $convId]);

        respondJson(['success' => true, 'message_id' => $msgId]);
        break;

    // 5. Admin: List Conversations
    case 'admin-conversations':
        requireAdmin();
        $status = $_GET['status'] ?? 'all';
        $search = $_GET['search'] ?? '';

        $where = [];
        $params = [];

        if ($status !== 'all') {
            $where[] = "c.status = ?";
            $params[] = $status;
        }

        if ($search) {
            $where[] = "(u.name LIKE ? OR u.email LIKE ? OR c.id LIKE ? OR c.subject LIKE ?)";
            $q = "%{$search}%";
            $params[] = $q; $params[] = $q; $params[] = $q; $params[] = $q;
        }

        $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

        try {
            $stmt = $db->prepare("
                SELECT 
                    c.*,
                    COALESCE(u.name, 'Visitor Guest') as user_name,
                    COALESCE(u.email, 'guest@profilevault.local') as user_email,
                    (SELECT name FROM users WHERE id = c.assigned_agent_id) as assigned_agent_name,
                    (SELECT message FROM support_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview,
                    (SELECT COUNT(*) FROM support_messages WHERE conversation_id = c.id AND sender_type = 'user' AND is_read = 0) as unread_count
                FROM support_conversations c
                LEFT JOIN users u ON c.user_id = u.id
                {$whereSql}
                ORDER BY c.last_message_at DESC
            ");
            $stmt->execute($params);
            respondJson(['success' => true, 'data' => $stmt->fetchAll()]);
        } catch (Throwable $e) {
            respondJson(['success' => true, 'data' => []]);
        }
        break;

    // 6. Admin: Add Internal Staff Note
    case 'admin-add-internal-note':
        requireAdmin();
        $convId = $input['conversation_id'] ?? '';
        $note = trim($input['note'] ?? '');
        if (!$convId || !$note) {
            respondJson(['success' => false, 'error' => 'Conversation ID and note are required.'], 400);
        }

        $noteId = 'note_' . bin2hex(random_bytes(8));
        $db->prepare("
            INSERT INTO support_internal_notes (id, conversation_id, agent_id, agent_name, note, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ")->execute([$noteId, $convId, $user['id'], $user['name'], $note]);

        respondJson(['success' => true, 'note_id' => $noteId]);
        break;

    default:
        respondJson(['success' => false, 'error' => 'Invalid support action.'], 404);
}
