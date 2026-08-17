<?php
// ──────────────────────────────────────────────
// ProfileVault — Real-Time SSE Stream & Event Delivery API
// ──────────────────────────────────────────────

require_once __DIR__ . '/../helpers.php';

$action = $_GET['action'] ?? '';
$db = Database::getConnection();

switch ($action) {

    // ── 1. SSE Real-Time Event Stream ──
    case 'stream':
        // Disable output buffering & timeouts
        if (function_exists('apache_setenv')) {
            @apache_setenv('no-gzip', '1');
        }
        @ini_set('zlib.output_compression', '0');
        @ini_set('implicit_flush', '1');
        while (ob_get_level() > 0) {
            ob_end_flush();
        }
        ob_implicit_flush(true);
        set_time_limit(0);

        // SSE Response Headers
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no'); // Essential for Nginx SSE streaming

        // Token Authentication (Header or Query Param for EventSource)
        $token = null;
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
            $token = $matches[1];
        } elseif (!empty($_GET['token'])) {
            $token = $_GET['token'];
        }

        if (!$token) {
            echo "event: error\n";
            echo "data: " . json_encode(['error' => 'Authentication token required']) . "\n\n";
            exit();
        }

        $userId = verifySessionToken($token);
        if (!$userId) {
            echo "event: error\n";
            echo "data: " . json_encode(['error' => 'Invalid or expired session token']) . "\n\n";
            exit();
        }

        // Fetch User and Permissions
        $stmt = $db->prepare("SELECT id, email, role, permissions, auth_version, account_status FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || $user['account_status'] === 'suspended' || $user['account_status'] === 'disabled') {
            echo "event: session.revoked\n";
            echo "data: " . json_encode(['reason' => 'Account is suspended or disabled', 'userId' => $userId]) . "\n\n";
            exit();
        }

        $userRole = strtolower($user['role'] ?? 'user');
        $authVersion = (int)($user['auth_version'] ?? 1);

        // Replay missed events if client provides Last-Event-ID or since_id
        $lastEventId = $_SERVER['HTTP_LAST_EVENT_ID'] ?? $_GET['last_event_id'] ?? null;
        $lastIdNumeric = 0;
        if ($lastEventId) {
            $idLookup = $db->prepare("SELECT id FROM realtime_events WHERE event_id = ?");
            $idLookup->execute([$lastEventId]);
            $foundRow = $idLookup->fetch();
            if ($foundRow) {
                $lastIdNumeric = (int)$foundRow['id'];
            }
        } elseif (!empty($_GET['since_id'])) {
            $lastIdNumeric = (int)$_GET['since_id'];
        }

        // Send Initial Handshake & Authorization State
        $handshake = [
            'type' => 'connection.established',
            'userId' => $userId,
            'role' => $userRole,
            'authVersion' => $authVersion,
            'serverTime' => date('c')
        ];
        echo "event: connected\n";
        echo "data: " . json_encode($handshake) . "\n\n";
        flush();

        // If client requested replay from earlier event
        if ($lastIdNumeric > 0) {
            $replayStmt = $db->prepare("
                SELECT * FROM realtime_events
                WHERE id > ? AND (user_id = ? OR target_role = ? OR target_role = '*' OR (user_id IS NULL AND target_role IS NULL))
                ORDER BY id ASC LIMIT 50
            ");
            $replayStmt->execute([$lastIdNumeric, $userId, $userRole]);
            while ($evt = $replayStmt->fetch(PDO::FETCH_ASSOC)) {
                $lastIdNumeric = max($lastIdNumeric, (int)$evt['id']);
                echo "id: {$evt['event_id']}\n";
                echo "event: {$evt['event_type']}\n";
                echo "data: " . $evt['payload'] . "\n\n";
                flush();
            }
        } else {
            // Get latest event ID so we only stream new events going forward
            $latestStmt = $db->query("SELECT MAX(id) as max_id FROM realtime_events");
            $maxRow = $latestStmt->fetch();
            $lastIdNumeric = (int)($maxRow['max_id'] ?? 0);
        }

        // Keep-Alive & Event Polling Loop (SSE Stream)
        $loopCount = 0;
        $maxLoops = 1800; // 30 minutes continuous connection

        while ($loopCount < $maxLoops) {
            if (connection_aborted()) {
                break;
            }

            // Check if user status or auth version changed
            if ($loopCount % 5 === 0) {
                $chkStmt = $db->prepare("SELECT auth_version, account_status FROM users WHERE id = ?");
                $chkStmt->execute([$userId]);
                $currentStatus = $chkStmt->fetch();

                if (!$currentStatus || $currentStatus['account_status'] === 'suspended' || $currentStatus['account_status'] === 'disabled') {
                    echo "event: session.revoked\n";
                    echo "data: " . json_encode([
                        'type' => 'session.revoked',
                        'userId' => $userId,
                        'reason' => 'Account is suspended or disabled by administrator',
                        'timestamp' => date('c')
                    ]) . "\n\n";
                    flush();
                    break;
                }
            }

            // Poll for newly published events
            $pollStmt = $db->prepare("
                SELECT * FROM realtime_events
                WHERE id > ? AND (user_id = ? OR target_role = ? OR target_role = '*' OR (user_id IS NULL AND target_role IS NULL))
                ORDER BY id ASC LIMIT 20
            ");
            $pollStmt->execute([$lastIdNumeric, $userId, $userRole]);
            $events = $pollStmt->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($events)) {
                foreach ($events as $evt) {
                    $lastIdNumeric = max($lastIdNumeric, (int)$evt['id']);
                    echo "id: {$evt['event_id']}\n";
                    echo "event: {$evt['event_type']}\n";
                    echo "data: " . $evt['payload'] . "\n\n";
                    flush();
                }
            }

            // Heartbeat ping every 5 seconds to keep FastCGI alive
            if ($loopCount % 5 === 0) {
                echo ": ping " . date('c') . "\n\n";
                flush();
            }

            $loopCount++;
            usleep(1000000); // sleep 1 second
        }

        // Graceful reconnect prompt for client
        echo "event: reconnect\n";
        echo "data: " . json_encode(['lastEventId' => $lastIdNumeric, 'time' => date('c')]) . "\n\n";
        flush();
        exit();
        break;

    // ── 2. Delta Polling Endpoint (Fallback for SSE) ──
    case 'poll':
        $token = getBearerToken();
        if (!$token) {
            respondJson(['success' => false, 'error' => 'Authentication token required.'], 401);
        }

        $userId = verifySessionToken($token);
        if (!$userId) {
            respondJson(['success' => false, 'error' => 'Invalid or expired session token.'], 401);
        }

        $stmt = $db->prepare("SELECT id, role, auth_version, account_status FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || $user['account_status'] === 'suspended' || $user['account_status'] === 'disabled') {
            respondJson([
                'success' => false,
                'sessionRevoked' => true,
                'error' => 'Account is suspended or disabled.'
            ], 403);
        }

        $sinceId = (int)($_GET['since_id'] ?? 0);
        $userRole = strtolower($user['role'] ?? 'user');

        $evtStmt = $db->prepare("
            SELECT id, event_id, user_id, target_role, event_type, payload, version, created_at
            FROM realtime_events
            WHERE id > ? AND (user_id = ? OR target_role = ? OR target_role = '*' OR (user_id IS NULL AND target_role IS NULL))
            ORDER BY id ASC LIMIT 50
        ");
        $evtStmt->execute([$sinceId, $userId, $userRole]);
        $events = $evtStmt->fetchAll(PDO::FETCH_ASSOC);

        $parsedEvents = array_map(function($e) {
            return [
                'id' => (int)$e['id'],
                'eventId' => $e['event_id'],
                'type' => $e['event_type'],
                'payload' => json_decode($e['payload'], true) ?? $e['payload'],
                'version' => (int)$e['version'],
                'createdAt' => $e['created_at']
            ];
        }, $events);

        respondJson([
            'success' => true,
            'authVersion' => (int)$user['auth_version'],
            'accountStatus' => $user['account_status'],
            'events' => $parsedEvents,
            'timestamp' => date('c')
        ]);
        break;

    default:
        respondJson(['success' => false, 'error' => "Unknown events action: {$action}"], 404);
        break;
}
