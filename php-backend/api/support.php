<?php
// ──────────────────────────────────────────────
// ProfileVault — Real-Time Live Chat & Support REST API
// Supports: Web Landing LiveChat Widget, Desktop Client, Admin Support Inbox & SSE Sync
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

sendJsonHeader();
$db = Database::getConnection();
$user = getAuthenticatedUser(); // Optional for public/guest chat widget, required for admin
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody, true) ?? $_POST;

switch ($action) {

    // ── 1. Get Public Live Chat Widget Settings ──
    case 'get-settings':
    case 'settings':
        try {
            $settingsStmt = $db->query("SELECT `key`, `value` FROM support_settings");
            $settingsRows = $settingsStmt->fetchAll(PDO::FETCH_KEY_PAIR);
            respondJson([
                'success' => true,
                'data' => [
                    'support_enabled' => ($settingsRows['support_enabled'] ?? 'true') === 'true',
                    'support_hours' => $settingsRows['support_hours'] ?? '24/7 Live Agent Support',
                    'widget_title' => $settingsRows['livechat_widget_title'] ?? 'ProfileVault Live Support',
                    'welcome_message' => $settingsRows['livechat_welcome_message'] ?? 'Hello! 👋 How can we help you today with your browser profiles, proxies, or subscriptions?',
                    'auto_reply_enabled' => ($settingsRows['auto_reply_enabled'] ?? 'true') === 'true',
                    'auto_reply_message' => $settingsRows['auto_reply_message'] ?? 'Thank you for reaching out! A technical support engineer has been notified.'
                ]
            ]);
        } catch (Throwable $e) {
            respondJson(['success' => true, 'data' => ['support_enabled' => true, 'widget_title' => 'ProfileVault Live Support']]);
        }
        break;

    // ── 2. Get Active Live Chat Thread (Visitor / User) ──
    case 'active-thread':
    case 'get-active-thread':
        $visitorToken = trim($_GET['visitor_token'] ?? $input['visitor_token'] ?? '');
        $userId = $user['id'] ?? null;

        if (!$visitorToken && !$userId) {
            respondJson(['success' => true, 'data' => null, 'messages' => []]);
        }

        $conv = null;
        if ($userId) {
            $stmt = $db->prepare("
                SELECT * FROM support_conversations 
                WHERE user_id = ? AND status != 'closed' 
                ORDER BY last_message_at DESC LIMIT 1
            ");
            $stmt->execute([$userId]);
            $conv = $stmt->fetch();
        }

        if (!$conv && $visitorToken) {
            $stmt = $db->prepare("
                SELECT * FROM support_conversations 
                WHERE visitor_token = ? AND status != 'closed' 
                ORDER BY last_message_at DESC LIMIT 1
            ");
            $stmt->execute([$visitorToken]);
            $conv = $stmt->fetch();
        }

        if (!$conv) {
            respondJson(['success' => true, 'data' => null, 'messages' => []]);
        }

        $msgStmt = $db->prepare("
            SELECT id, conversation_id, sender_id, sender_name, sender_type, message, message_type, is_read, created_at 
            FROM support_messages 
            WHERE conversation_id = ? 
            ORDER BY created_at ASC
        ");
        $msgStmt->execute([$conv['id']]);
        $messages = $msgStmt->fetchAll();

        respondJson([
            'success' => true,
            'data' => $conv,
            'messages' => $messages
        ]);
        break;

    // ── 3. Send Message (Guest Visitor or Authenticated User) ──
    case 'send':
    case 'send-message':
        $visitorToken = trim($input['visitor_token'] ?? $_GET['visitor_token'] ?? '');
        $messageText = trim($input['message'] ?? $input['initialMessage'] ?? '');
        $guestName = trim($input['name'] ?? $input['guest_name'] ?? '');
        $guestEmail = trim($input['email'] ?? $input['guest_email'] ?? '');
        $channel = $input['channel'] ?? ($user ? 'desktop' : 'widget');
        $subject = trim($input['subject'] ?? 'Live Chat Support');

        if (!$messageText) {
            respondJson(['success' => false, 'error' => 'Message text cannot be empty.'], 400);
        }

        $userId = $user['id'] ?? null;
        $senderName = $user['name'] ?? ($guestName ?: 'Guest Visitor');
        $senderEmail = $user['email'] ?? ($guestEmail ?: ($visitorToken ? "visitor-{$visitorToken}@guest.local" : 'guest@profilevault.local'));

        // If user is not logged in and no visitor token provided, generate one
        if (!$userId && !$visitorToken) {
            $visitorToken = 'vis_' . bin2hex(random_bytes(12));
        }

        // Find existing open conversation
        $conv = null;
        if ($userId) {
            $stmt = $db->prepare("SELECT * FROM support_conversations WHERE user_id = ? AND status != 'closed' ORDER BY last_message_at DESC LIMIT 1");
            $stmt->execute([$userId]);
            $conv = $stmt->fetch();
        }

        if (!$conv && $visitorToken) {
            $stmt = $db->prepare("SELECT * FROM support_conversations WHERE visitor_token = ? AND status != 'closed' ORDER BY last_message_at DESC LIMIT 1");
            $stmt->execute([$visitorToken]);
            $conv = $stmt->fetch();
        }

        $isNewConversation = false;
        if (!$conv) {
            $isNewConversation = true;
            $convId = 'conv_' . bin2hex(random_bytes(8));

            $insertConv = $db->prepare("
                INSERT INTO support_conversations (id, user_id, visitor_token, guest_name, guest_email, channel, status, priority, subject, last_message_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'open', 'normal', ?, NOW(), NOW())
            ");
            $insertConv->execute([
                $convId,
                $userId,
                $visitorToken,
                $guestName ?: ($user['name'] ?? 'Visitor Guest'),
                $guestEmail ?: ($user['email'] ?? ''),
                $channel,
                $subject
            ]);

            $conv = [
                'id' => $convId,
                'user_id' => $userId,
                'visitor_token' => $visitorToken,
                'guest_name' => $guestName,
                'guest_email' => $guestEmail,
                'channel' => $channel,
                'status' => 'open'
            ];
        } else {
            $convId = $conv['id'];
            // Update conversation details
            $db->prepare("
                UPDATE support_conversations 
                SET last_message_at = NOW(), 
                    status = 'open',
                    guest_name = COALESCE(NULLIF(?, ''), guest_name),
                    guest_email = COALESCE(NULLIF(?, ''), guest_email)
                WHERE id = ?
            ")->execute([$guestName, $guestEmail, $convId]);
        }

        // Insert message
        $msgId = 'msg_' . bin2hex(random_bytes(8));
        $msgStmt = $db->prepare("
            INSERT INTO support_messages (id, conversation_id, sender_id, sender_name, sender_type, message, message_type, is_read, created_at)
            VALUES (?, ?, ?, ?, 'user', ?, 'text', 0, NOW())
        ");
        $msgStmt->execute([
            $msgId,
            $convId,
            $userId ?: $visitorToken,
            $senderName,
            $messageText
        ]);

        // Publish real-time SSE event for admin inbox
        publishEvent('support.message.created', [
            'conversation_id' => $convId,
            'message_id' => $msgId,
            'sender_name' => $senderName,
            'sender_email' => $senderEmail,
            'sender_type' => 'user',
            'channel' => $channel,
            'message' => $messageText,
            'created_at' => date('c')
        ]);

        // Auto-Reply on new conversation if enabled
        if ($isNewConversation) {
            try {
                $autoRow = $db->query("SELECT value FROM support_settings WHERE `key` = 'auto_reply_message'")->fetch();
                $autoEnabled = $db->query("SELECT value FROM support_settings WHERE `key` = 'auto_reply_enabled'")->fetch();
                if ($autoEnabled && ($autoEnabled['value'] === 'true' || $autoEnabled['value'] === '1') && $autoRow && !empty($autoRow['value'])) {
                    $autoMsgId = 'msg_auto_' . bin2hex(random_bytes(8));
                    $db->prepare("
                        INSERT INTO support_messages (id, conversation_id, sender_id, sender_name, sender_type, message, message_type, is_read, created_at)
                        VALUES (?, ?, 'agent_system', 'Support Team', 'agent', ?, 'text', 1, DATE_ADD(NOW(), INTERVAL 1 SECOND))
                    ")->execute([$autoMsgId, $convId, $autoRow['value']]);

                    publishEvent('support.reply.created', [
                        'conversation_id' => $convId,
                        'message_id' => $autoMsgId,
                        'sender_name' => 'Support Team',
                        'sender_type' => 'agent',
                        'message' => $autoRow['value'],
                        'created_at' => date('c')
                    ]);
                }
            } catch (Throwable $e) {}
        }

        respondJson([
            'success' => true,
            'conversation_id' => $convId,
            'visitor_token' => $visitorToken,
            'message_id' => $msgId,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        break;

    // ── 4. Get Conversation Messages History ──
    case 'messages':
    case 'get-messages':
        $convId = trim($_GET['conversation_id'] ?? $input['conversation_id'] ?? '');
        $visitorToken = trim($_GET['visitor_token'] ?? $input['visitor_token'] ?? '');

        if (!$convId && !$visitorToken && !$user) {
            respondJson(['success' => false, 'error' => 'Conversation or visitor identification required.'], 400);
        }

        if (!$convId) {
            if ($user) {
                $stmt = $db->prepare("SELECT id FROM support_conversations WHERE user_id = ? ORDER BY last_message_at DESC LIMIT 1");
                $stmt->execute([$user['id']]);
                $c = $stmt->fetch();
                $convId = $c['id'] ?? null;
            } elseif ($visitorToken) {
                $stmt = $db->prepare("SELECT id FROM support_conversations WHERE visitor_token = ? ORDER BY last_message_at DESC LIMIT 1");
                $stmt->execute([$visitorToken]);
                $c = $stmt->fetch();
                $convId = $c['id'] ?? null;
            }
        }

        if (!$convId) {
            respondJson(['success' => true, 'data' => []]);
        }

        // Fetch messages
        $msgStmt = $db->prepare("
            SELECT id, conversation_id, sender_id, sender_name, sender_type, message, message_type, is_read, created_at
            FROM support_messages 
            WHERE conversation_id = ? 
            ORDER BY created_at ASC
        ");
        $msgStmt->execute([$convId]);
        $messages = $msgStmt->fetchAll();

        respondJson(['success' => true, 'conversation_id' => $convId, 'data' => $messages]);
        break;

    // ── 5. Admin: Get All Conversations ──
    case 'admin-conversations':
        requireAdmin();
        $status = $_GET['status'] ?? 'all';
        $search = trim($_GET['search'] ?? '');

        $where = [];
        $params = [];

        if ($status !== 'all') {
            $where[] = "c.status = ?";
            $params[] = $status;
        }

        if ($search) {
            $where[] = "(u.name LIKE ? OR u.email LIKE ? OR c.guest_name LIKE ? OR c.guest_email LIKE ? OR c.id LIKE ? OR c.subject LIKE ?)";
            $q = "%{$search}%";
            $params[] = $q; $params[] = $q; $params[] = $q; $params[] = $q; $params[] = $q; $params[] = $q;
        }

        $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

        try {
            $stmt = $db->prepare("
                SELECT 
                    c.*,
                    COALESCE(u.name, c.guest_name, 'Visitor Guest') as display_name,
                    COALESCE(u.email, c.guest_email, 'No Email Provided') as display_email,
                    COALESCE(p.name, 'Free / Guest') as plan_name,
                    (SELECT name FROM users WHERE id = c.assigned_agent_id) as assigned_agent_name,
                    (SELECT message FROM support_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview,
                    (SELECT created_at FROM support_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg_time,
                    (SELECT COUNT(*) FROM support_messages WHERE conversation_id = c.id AND sender_type = 'user' AND is_read = 0) as unread_count
                FROM support_conversations c
                LEFT JOIN users u ON c.user_id = u.id
                LEFT JOIN subscriptions s ON u.id = s.user_id
                LEFT JOIN pricing_plans p ON s.plan_id = p.id
                {$whereSql}
                ORDER BY c.last_message_at DESC
            ");
            $stmt->execute($params);
            respondJson(['success' => true, 'data' => $stmt->fetchAll()]);
        } catch (Throwable $e) {
            respondJson(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    // ── 6. Admin: Get Single Conversation Thread & Mark Read ──
    case 'admin-thread':
    case 'admin-get-thread':
        requireAdmin();
        $convId = trim($_GET['conversation_id'] ?? $input['conversation_id'] ?? '');
        if (!$convId) respondJson(['success' => false, 'error' => 'Conversation ID is required.'], 400);

        $convStmt = $db->prepare("
            SELECT 
                c.*,
                COALESCE(u.name, c.guest_name, 'Visitor Guest') as display_name,
                COALESCE(u.email, c.guest_email, 'No Email Provided') as display_email,
                COALESCE(u.account_status, 'active') as user_status,
                u.role as user_role,
                COALESCE(p.name, 'Free Plan') as plan_name,
                s.device_limit,
                (SELECT COUNT(*) FROM browser_profiles WHERE user_id = c.user_id) as profile_count
            FROM support_conversations c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN subscriptions s ON u.id = s.user_id
            LEFT JOIN pricing_plans p ON s.plan_id = p.id
            WHERE c.id = ?
        ");
        $convStmt->execute([$convId]);
        $conv = $convStmt->fetch();

        if (!$conv) respondJson(['success' => false, 'error' => 'Conversation not found.'], 404);

        // Mark user messages as read
        $db->prepare("UPDATE support_messages SET is_read = 1, read_at = NOW() WHERE conversation_id = ? AND sender_type = 'user' AND is_read = 0")->execute([$convId]);

        // Get messages
        $msgStmt = $db->prepare("SELECT * FROM support_messages WHERE conversation_id = ? ORDER BY created_at ASC");
        $msgStmt->execute([$convId]);
        $messages = $msgStmt->fetchAll();

        // Get internal staff notes
        $noteStmt = $db->prepare("SELECT * FROM support_internal_notes WHERE conversation_id = ? ORDER BY created_at ASC");
        $noteStmt->execute([$convId]);
        $notes = $noteStmt->fetchAll();

        respondJson([
            'success' => true,
            'conversation' => $conv,
            'messages' => $messages,
            'internal_notes' => $notes
        ]);
        break;

    // ── 7. Admin: Send Reply Message ──
    case 'admin-reply':
    case 'admin-send-reply':
        requireAdmin();
        $adminUser = $user;
        $convId = trim($input['conversation_id'] ?? '');
        $messageText = trim($input['message'] ?? '');

        if (!$convId || !$messageText) {
            respondJson(['success' => false, 'error' => 'Conversation ID and message are required.'], 400);
        }

        // Verify conversation exists
        $stmt = $db->prepare("SELECT * FROM support_conversations WHERE id = ?");
        $stmt->execute([$convId]);
        $conv = $stmt->fetch();
        if (!$conv) respondJson(['success' => false, 'error' => 'Conversation thread not found.'], 404);

        $msgId = 'msg_' . bin2hex(random_bytes(8));
        $adminName = $adminUser['name'] ?? 'Support Team';

        // Insert agent reply
        $db->prepare("
            INSERT INTO support_messages (id, conversation_id, sender_id, sender_name, sender_type, message, message_type, is_read, created_at)
            VALUES (?, ?, ?, ?, 'agent', ?, 'text', 1, NOW())
        ")->execute([
            $msgId,
            $convId,
            $adminUser['id'],
            $adminName,
            $messageText
        ]);

        // Update conversation state
        $db->prepare("
            UPDATE support_conversations 
            SET last_message_at = NOW(), 
                status = 'waiting_user',
                assigned_agent_id = ?
            WHERE id = ?
        ")->execute([$adminUser['id'], $convId]);

        // Broadcast real-time reply via SSE
        publishEvent('support.reply.created', [
            'conversation_id' => $convId,
            'message_id' => $msgId,
            'sender_id' => $adminUser['id'],
            'sender_name' => $adminName,
            'sender_type' => 'agent',
            'message' => $messageText,
            'visitor_token' => $conv['visitor_token'],
            'user_id' => $conv['user_id'],
            'created_at' => date('c')
        ]);

        respondJson([
            'success' => true,
            'message_id' => $msgId,
            'sender_name' => $adminName,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        break;

    // ── 8. Admin: Close / Resolve Conversation ──
    case 'admin-close':
    case 'admin-close-conversation':
        requireAdmin();
        $convId = trim($input['conversation_id'] ?? '');
        if (!$convId) respondJson(['success' => false, 'error' => 'Conversation ID required.'], 400);

        $db->prepare("UPDATE support_conversations SET status = 'closed', closed_at = NOW(), last_message_at = NOW() WHERE id = ?")->execute([$convId]);

        publishEvent('support.conversation.closed', ['conversation_id' => $convId]);

        respondJson(['success' => true, 'message' => 'Conversation marked as closed.']);
        break;

    // ── 9. Admin: Add Internal Staff Note ──
    case 'admin-add-internal-note':
        requireAdmin();
        $convId = trim($input['conversation_id'] ?? '');
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

    // ── 10. Admin: Save Support System Settings ──
    case 'admin-save-settings':
        requireAdmin();
        $fields = ['support_enabled', 'support_hours', 'auto_reply_enabled', 'auto_reply_message', 'livechat_widget_title', 'livechat_welcome_message'];
        foreach ($fields as $f) {
            if (isset($input[$f])) {
                $val = is_bool($input[$f]) ? ($input[$f] ? 'true' : 'false') : (string)$input[$f];
                $db->prepare("INSERT INTO support_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?")->execute([$f, $val, $val]);
            }
        }
        respondJson(['success' => true, 'message' => 'Support settings updated successfully.']);
        break;

    default:
        respondJson(['success' => false, 'error' => 'Invalid support action.'], 404);
}

