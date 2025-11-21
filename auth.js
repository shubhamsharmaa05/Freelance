const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * REGISTER - Create new user with profile and wallet
 * POST /auth/register
 */
router.post("/register", (req, res) => {
    const { name, email, password, role, phone } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
        return res.json({ 
            status: "error", 
            message: "All fields are required" 
        });
    }

    // Check if email already exists
    const checkSql = "SELECT email FROM users WHERE email = ?";
    db.query(checkSql, [email], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.json({ 
                status: "error", 
                message: "Database error" 
            });
        }

        if (result.length > 0) {
            return res.json({ 
                status: "error", 
                message: "Email already exists" 
            });
        }

        // Insert new user
        const insertUserSql = "INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)";
        db.query(insertUserSql, [name, email, password, role, phone || null], (err, result) => {
            if (err) {
                console.error("Registration error:", err);
                return res.json({ 
                    status: "error", 
                    message: "Registration failed" 
                });
            }

            const userId = result.insertId;

            // Create user profile
            const createProfileSql = "INSERT INTO user_profiles (user_id) VALUES (?)";
            db.query(createProfileSql, [userId], (err) => {
                if (err) {
                    console.error("Profile creation error:", err);
                }
            });

            // Create wallet for user
            const createWalletSql = "INSERT INTO wallets (user_id) VALUES (?)";
            db.query(createWalletSql, [userId], (err) => {
                if (err) {
                    console.error("Wallet creation error:", err);
                }
            });

            console.log(`✅ New user registered: ${name} (ID: ${userId})`);
            res.json({ 
                status: "success", 
                message: "Registration successful",
                userId: userId
            });
        });
    });
});

/**
 * LOGIN - Authenticate user and log activity
 * POST /auth/login
 */
router.post("/login", (req, res) => {
    const { email, password, ip_address, user_agent } = req.body;

    // Validation
    if (!email || !password) {
        return res.json({ 
            status: "error", 
            message: "Email and password are required" 
        });
    }

    const sql = `
        SELECT u.user_id, u.name, u.email, u.role, u.phone, u.profile_picture, u.is_verified
        FROM users u
        WHERE u.email = ? AND u.password = ? AND u.is_active = TRUE
    `;
    
    db.query(sql, [email, password], (err, result) => {
        if (err) {
            console.error("Login error:", err);
            return res.json({ 
                status: "error", 
                message: "Database error" 
            });
        }

        if (result.length === 0) {
            // Log failed login attempt
            const failedLoginSql = "INSERT INTO login_history (user_id, ip_address, user_agent, login_status) SELECT user_id, ?, ?, 'failed' FROM users WHERE email = ? LIMIT 1";
            db.query(failedLoginSql, [ip_address, user_agent, email]);

            return res.json({ 
                status: "error", 
                message: "Invalid email or password" 
            });
        }

        const user = result[0];

        // Update last login
        const updateLoginSql = "UPDATE users SET last_login = NOW() WHERE user_id = ?";
        db.query(updateLoginSql, [user.user_id]);

        // Log successful login
        const loginHistorySql = "INSERT INTO login_history (user_id, ip_address, user_agent, login_status) VALUES (?, ?, ?, 'success')";
        db.query(loginHistorySql, [user.user_id, ip_address, user_agent]);

        // Create welcome notification for first login
        const notificationSql = "INSERT INTO notifications (user_id, notification_type, title, message) VALUES (?, 'system', 'Welcome to Freelance Hub!', 'Start exploring jobs and building your career.')";
        db.query(notificationSql, [user.user_id]);

        console.log(`✅ User logged in: ${user.name} (ID: ${user.user_id})`);
        res.json({
            status: "success",
            message: "Login successful",
            user: user
        });
    });
});

/**
 * GET USER PROFILE - Complete profile with stats
 * GET /auth/profile/:user_id
 */
router.get("/profile/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT 
            u.user_id, u.name, u.email, u.role, u.phone, u.profile_picture, 
            u.is_verified, u.created_at,
            up.bio, up.title, up.hourly_rate, up.availability, up.age, 
            up.location, up.country, up.languages, up.github_link, 
            up.linkedin_link, up.portfolio_link, up.website,
            up.experience_years, up.total_earnings, up.total_jobs_completed,
            up.success_rate, up.profile_completed,
            w.balance as wallet_balance, w.pending_balance,
            (SELECT AVG(rating) FROM reviews WHERE reviewee_id = u.user_id) as avg_rating,
            (SELECT COUNT(*) FROM reviews WHERE reviewee_id = u.user_id) as total_reviews
        FROM users u
        LEFT JOIN user_profiles up ON u.user_id = up.user_id
        LEFT JOIN wallets w ON u.user_id = w.user_id
        WHERE u.user_id = ?
    `;
    
    db.query(sql, [user_id], (err, result) => {
        if (err) {
            console.error("Profile fetch error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch profile" 
            });
        }

        if (result.length === 0) {
            return res.json({ 
                status: "error", 
                message: "User not found" 
            });
        }

        // Get user skills
        const skillsSql = `
            SELECT s.skill_name, us.proficiency_level, us.years_experience
            FROM user_skills us
            JOIN skills s ON us.skill_id = s.skill_id
            WHERE us.user_id = ?
        `;
        
        db.query(skillsSql, [user_id], (err, skills) => {
            result[0].skills = skills || [];
            
            res.json({
                status: "success",
                user: result[0]
            });
        });
    });
});

/**
 * UPDATE USER PROFILE - Enhanced with skills
 * PUT /auth/profile/update
 */
router.put("/profile/update", (req, res) => {
    const { 
        user_id, name, phone, bio, title, hourly_rate, age, 
        location, country, languages, github_link, linkedin_link, 
        portfolio_link, website, availability 
    } = req.body;

    if (!user_id || !name) {
        return res.json({ 
            status: "error", 
            message: "User ID and name are required" 
        });
    }

    // Update users table
    const updateUserSql = "UPDATE users SET name = ?, phone = ? WHERE user_id = ?";
    db.query(updateUserSql, [name, phone, user_id], (err) => {
        if (err) {
            console.error("User update error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to update user" 
            });
        }

        // Update user_profiles table
        const updateProfileSql = `
            UPDATE user_profiles 
            SET bio = ?, title = ?, hourly_rate = ?, age = ?, 
                location = ?, country = ?, languages = ?,
                github_link = ?, linkedin_link = ?, portfolio_link = ?,
                website = ?, availability = ?, profile_completed = TRUE
            WHERE user_id = ?
        `;

        db.query(updateProfileSql, [
            bio, title, hourly_rate, age, location, country, languages,
            github_link, linkedin_link, portfolio_link, website, 
            availability || 'available', user_id
        ], (err, result) => {
            if (err) {
                console.error("Profile update error:", err);
                return res.json({ 
                    status: "error", 
                    message: "Failed to update profile" 
                });
            }

            // Create audit log
            const auditSql = "INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES (?, 'UPDATE', 'user_profiles', ?)";
            db.query(auditSql, [user_id, user_id]);

            console.log(`✅ Profile updated for user ID: ${user_id}`);
            res.json({ 
                status: "success", 
                message: "Profile updated successfully" 
            });
        });
    });
});

/**
 * ADD USER SKILL
 * POST /auth/profile/add-skill
 */
router.post("/profile/add-skill", (req, res) => {
    const { user_id, skill_name, proficiency_level, years_experience } = req.body;

    if (!user_id || !skill_name) {
        return res.json({
            status: "error",
            message: "User ID and skill name are required"
        });
    }

    // First, check if skill exists, if not create it
    const checkSkillSql = "SELECT skill_id FROM skills WHERE skill_name = ?";
    db.query(checkSkillSql, [skill_name], (err, result) => {
        if (err) {
            return res.json({ status: "error", message: "Database error" });
        }

        let skillId;
        
        if (result.length === 0) {
            // Create new skill
            const createSkillSql = "INSERT INTO skills (skill_name) VALUES (?)";
            db.query(createSkillSql, [skill_name], (err, result) => {
                if (err) {
                    return res.json({ status: "error", message: "Failed to create skill" });
                }
                skillId = result.insertId;
                addUserSkill(user_id, skillId, proficiency_level, years_experience, res);
            });
        } else {
            skillId = result[0].skill_id;
            addUserSkill(user_id, skillId, proficiency_level, years_experience, res);
        }
    });
});

function addUserSkill(user_id, skill_id, proficiency_level, years_experience, res) {
    const sql = "INSERT INTO user_skills (user_id, skill_id, proficiency_level, years_experience) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE proficiency_level = ?, years_experience = ?";
    
    db.query(sql, [user_id, skill_id, proficiency_level || 'intermediate', years_experience || 0, proficiency_level || 'intermediate', years_experience || 0], (err) => {
        if (err) {
            return res.json({ status: "error", message: "Failed to add skill" });
        }
        res.json({ status: "success", message: "Skill added successfully" });
    });
}

/**
 * GET ALL SKILLS
 * GET /auth/skills
 */
router.get("/skills", (req, res) => {
    const sql = "SELECT * FROM skills ORDER BY skill_name";
    db.query(sql, (err, result) => {
        if (err) {
            return res.json({ status: "error", message: "Failed to fetch skills" });
        }
        res.json({ status: "success", skills: result });
    });
});

/**
 * GET USER NOTIFICATIONS
 * GET /auth/notifications/:user_id
 */
router.get("/notifications/:user_id", (req, res) => {
    const { user_id } = req.params;
    
    const sql = `
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
    `;
    
    db.query(sql, [user_id], (err, result) => {
        if (err) {
            return res.json({ status: "error", message: "Failed to fetch notifications" });
        }
        res.json({ status: "success", notifications: result });
    });
});

/**
 * MARK NOTIFICATION AS READ
 * PUT /auth/notifications/read/:notification_id
 */
router.put("/notifications/read/:notification_id", (req, res) => {
    const { notification_id } = req.params;
    
    const sql = "UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE notification_id = ?";
    db.query(sql, [notification_id], (err) => {
        if (err) {
            return res.json({ status: "error", message: "Failed to update notification" });
        }
        res.json({ status: "success", message: "Notification marked as read" });
    });
});

/**
 * GET USER WALLET
 * GET /auth/wallet/:user_id
 */
router.get("/wallet/:user_id", (req, res) => {
    const { user_id } = req.params;
    
    const sql = "SELECT * FROM wallets WHERE user_id = ?";
    db.query(sql, [user_id], (err, result) => {
        if (err) {
            return res.json({ status: "error", message: "Failed to fetch wallet" });
        }
        
        if (result.length === 0) {
            return res.json({ status: "error", message: "Wallet not found" });
        }
        
        res.json({ status: "success", wallet: result[0] });
    });
});

/**
 * GET WALLET TRANSACTIONS
 * GET /auth/wallet/transactions/:user_id
 */
router.get("/wallet/transactions/:user_id", (req, res) => {
    const { user_id } = req.params;
    
    const sql = `
        SELECT * FROM transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 100
    `;
    
    db.query(sql, [user_id], (err, result) => {
        if (err) {
            return res.json({ status: "error", message: "Failed to fetch transactions" });
        }
        res.json({ status: "success", transactions: result });
    });
});

module.exports = router;