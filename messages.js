const express = require("express");
const router = express.Router();
const db = require("../db");

console.log("✅ Messages routes loaded");

/**
 * GET ALL CONVERSATIONS FOR A USER
 * GET /messages/conversations/:user_id
 */
router.get("/conversations/:user_id", (req, res) => {
    const { user_id } = req.params;
    console.log(`📥 GET /messages/conversations/${user_id} called`);

    const sql = `
        SELECT 
            CASE 
                WHEN m.sender_id = ? THEN m.receiver_id 
                ELSE m.sender_id 
            END as other_user_id,
            u.name as other_user_name,
            u.profile_picture,
            MAX(m.sent_at) as last_message_time,
            (SELECT message_text FROM messages 
             WHERE (sender_id = ? AND receiver_id = other_user_id) 
                OR (sender_id = other_user_id AND receiver_id = ?)
             ORDER BY sent_at DESC LIMIT 1) as last_message,
            (SELECT COUNT(*) FROM messages 
             WHERE receiver_id = ? 
               AND sender_id = other_user_id 
               AND is_read = FALSE) as unread_count
        FROM messages m
        JOIN users u ON u.user_id = CASE 
            WHEN m.sender_id = ? THEN m.receiver_id 
            ELSE m.sender_id 
        END
        WHERE m.sender_id = ? OR m.receiver_id = ?
        GROUP BY other_user_id, u.name, u.profile_picture
        ORDER BY last_message_time DESC
    `;
    
    db.query(sql, [user_id, user_id, user_id, user_id, user_id, user_id, user_id], (err, result) => {
        if (err) {
            console.error("❌ Get conversations error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch conversations" 
            });
        }

        console.log(`✅ Found ${result.length} conversations`);
        res.json({
            status: "success",
            conversations: result
        });
    });
});

/**
 * GET MESSAGE THREAD BETWEEN TWO USERS
 * GET /messages/thread/:user1_id/:user2_id
 */
router.get("/thread/:user1_id/:user2_id", (req, res) => {
    const { user1_id, user2_id } = req.params;
    console.log(`📥 GET /messages/thread/${user1_id}/${user2_id} called`);

    const sql = `
        SELECT 
            m.*,
            u1.name as sender_name,
            u2.name as receiver_name
        FROM messages m
        JOIN users u1 ON m.sender_id = u1.user_id
        JOIN users u2 ON m.receiver_id = u2.user_id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.sent_at ASC
    `;
    
    db.query(sql, [user1_id, user2_id, user2_id, user1_id], (err, result) => {
        if (err) {
            console.error("❌ Get messages error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch messages" 
            });
        }

        console.log(`✅ Found ${result.length} messages`);
        res.json({
            status: "success",
            messages: result
        });
    });
});

/**
 * SEND MESSAGE
 * POST /messages/send
 */
router.post("/send", (req, res) => {
    console.log("📥 POST /messages/send called");
    
    const { sender_id, receiver_id, message_text } = req.body;

    if (!sender_id || !receiver_id || !message_text) {
        return res.json({ 
            status: "error", 
            message: "All fields are required" 
        });
    }

    const sql = `
        INSERT INTO messages (sender_id, receiver_id, message_text)
        VALUES (?, ?, ?)
    `;
    
    db.query(sql, [sender_id, receiver_id, message_text], (err, result) => {
        if (err) {
            console.error("❌ Send message error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to send message" 
            });
        }

        // Create notification for receiver
        const notifSql = `
            INSERT INTO notifications (user_id, notification_type, title, message, related_id)
            SELECT ?, 'message', 'New Message', CONCAT('You received a message from ', name), ?
            FROM users WHERE user_id = ?
        `;
        
        db.query(notifSql, [receiver_id, sender_id, sender_id], (err) => {
            if (err) {
                console.error("Notification error:", err);
            }
        });

        console.log(`✅ Message sent from ${sender_id} to ${receiver_id}`);
        res.json({ 
            status: "success", 
            message: "Message sent successfully",
            messageId: result.insertId
        });
    });
});

/**
 * MARK MESSAGES AS READ
 * POST /messages/mark-read
 */
router.post("/mark-read", (req, res) => {
    console.log("📥 POST /messages/mark-read called");
    
    const { receiver_id, sender_id } = req.body;

    if (!receiver_id || !sender_id) {
        return res.json({ 
            status: "error", 
            message: "Receiver and sender IDs are required" 
        });
    }

    const sql = `
        UPDATE messages 
        SET is_read = TRUE, read_at = NOW()
        WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE
    `;
    
    db.query(sql, [receiver_id, sender_id], (err, result) => {
        if (err) {
            console.error("❌ Mark read error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to mark messages as read" 
            });
        }

        console.log(`✅ Marked ${result.affectedRows} messages as read`);
        res.json({ 
            status: "success", 
            message: "Messages marked as read"
        });
    });
});

/**
 * GET ALL USERS (FOR NEW MESSAGE)
 * GET /messages/users/:current_user_id
 */
router.get("/users/:current_user_id", (req, res) => {
    const { current_user_id } = req.params;
    console.log(`📥 GET /messages/users/${current_user_id} called`);

    const sql = `
        SELECT user_id, name, email, role, profile_picture
        FROM users
        WHERE user_id != ? AND is_active = TRUE
        ORDER BY name
    `;
    
    db.query(sql, [current_user_id], (err, result) => {
        if (err) {
            console.error("❌ Get users error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch users" 
            });
        }

        console.log(`✅ Found ${result.length} users`);
        res.json({
            status: "success",
            users: result
        });
    });
});

/**
 * DELETE MESSAGE
 * DELETE /messages/delete/:message_id
 */
router.delete("/delete/:message_id", (req, res) => {
    const { message_id } = req.params;
    console.log(`📥 DELETE /messages/delete/${message_id} called`);

    const sql = "DELETE FROM messages WHERE message_id = ?";
    
    db.query(sql, [message_id], (err, result) => {
        if (err) {
            console.error("❌ Delete message error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to delete message" 
            });
        }

        if (result.affectedRows === 0) {
            return res.json({ 
                status: "error", 
                message: "Message not found" 
            });
        }

        console.log(`✅ Message ${message_id} deleted`);
        res.json({ 
            status: "success", 
            message: "Message deleted successfully" 
        });
    });
});

console.log("✅ Messages routes configured");

module.exports = router;