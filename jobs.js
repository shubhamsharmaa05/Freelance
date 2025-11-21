const express = require("express");
const router = express.Router();
const db = require("../db");

console.log("✅ Jobs routes loaded");

// Experience level mapping helper
const expLevelMap = {
    "entry": "beginner",
    "beginner": "beginner",
    "intermediate": "intermediate",
    "advanced": "advanced",
    "expert": "expert"
};

/**
 * TEST ROUTE - Must come before /:job_id
 * GET /jobs/test
 */
router.get("/test", (req, res) => {
    res.json({ 
        status: "success", 
        message: "Jobs routes are working!" 
    });
});

/**
 * GET ALL CATEGORIES - Must come before /:job_id
 * GET /jobs/categories/all
 */
router.get("/categories/all", (req, res) => {
    console.log("🔥 GET /jobs/categories/all called");
    
    const sql = "SELECT * FROM job_categories ORDER BY category_name";
    
    db.query(sql, (err, result) => {
        if (err) {
            console.error("❌ Get categories error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch categories" 
            });
        }
        
        console.log(`✅ Found ${result.length} categories`);
        res.json({ status: "success", categories: result });
    });
});

/**
 * GET ALL JOBS - Enhanced with filters
 * GET /jobs/all
 */
router.get("/all", (req, res) => {
    console.log("🔥 GET /jobs/all called");
    
    const { category_id, experience_level, budget_min, budget_max } = req.query;
    
    let sql = `
        SELECT 
            j.*,
            u.name as client_name,
            u.email as client_email,
            COALESCE(j.views_count, 0) as views_count
        FROM jobs j
        LEFT JOIN users u ON j.client_id = u.user_id
        WHERE 1=1
    `;
    
    const params = [];
    
    if (category_id) {
        sql += " AND j.category_id = ?";
        params.push(category_id);
    }
    
    if (experience_level) {
        sql += " AND j.experience_level = ?";
        params.push(experience_level);
    }
    
    if (budget_min) {
        sql += " AND j.budget_min >= ?";
        params.push(budget_min);
    }
    
    if (budget_max) {
        sql += " AND j.budget_max <= ?";
        params.push(budget_max);
    }
    
    sql += " ORDER BY j.created_at DESC";

    db.query(sql, params, (err, jobs) => {
        if (err) {
            console.error("❌ Get jobs error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch jobs",
                error: err.message
            });
        }

        console.log(`✅ Found ${jobs.length} jobs`);

        // Get additional data for each job
        const jobPromises = jobs.map(job => {
            return new Promise((resolve) => {
                // Get proposal count
                db.query(
                    "SELECT COUNT(*) as count FROM proposals WHERE job_id = ?", 
                    [job.job_id], 
                    (err, propResult) => {
                        if (!err && propResult.length > 0) {
                            job.total_proposals = propResult[0].count;
                        } else {
                            job.total_proposals = 0;
                        }

                        // Get skills
                        db.query(
                            `SELECT s.skill_name FROM job_skills js 
                             JOIN skills s ON js.skill_id = s.skill_id 
                             WHERE js.job_id = ?`,
                            [job.job_id],
                            (err, skillsResult) => {
                                if (!err && skillsResult.length > 0) {
                                    job.required_skills = skillsResult.map(s => s.skill_name).join(', ');
                                } else {
                                    job.required_skills = '';
                                }

                                // Get category name
                                if (job.category_id) {
                                    db.query(
                                        "SELECT category_name FROM job_categories WHERE category_id = ?",
                                        [job.category_id],
                                        (err, catResult) => {
                                            if (!err && catResult.length > 0) {
                                                job.category_name = catResult[0].category_name;
                                            }
                                            resolve(job);
                                        }
                                    );
                                } else {
                                    resolve(job);
                                }
                            }
                        );
                    }
                );
            });
        });

        Promise.all(jobPromises).then(enrichedJobs => {
            res.json({
                status: "success",
                jobs: enrichedJobs
            });
        });
    });
});

/**
 * CREATE NEW JOB + SKILLS
 * POST /jobs/create
 */
router.post("/create", (req, res) => {
    console.log("🔥 POST /jobs/create", req.body);

    const {
        client_id,
        category_id,
        title,
        description,
        requirements,
        budget_type = "fixed",
        budget_min = 0,
        budget_max = 0,
        duration,
        experience_level = "intermediate",
        deadline,
        skills = []
    } = req.body;

    // Required fields validation
    if (!client_id || !title || !description) {
        return res.json({ 
            status: "error", 
            message: "Client ID, title and description are required" 
        });
    }

    // Map experience level
    const finalExperience = expLevelMap[experience_level] || "intermediate";

    const sql = `
        INSERT INTO jobs 
        (client_id, category_id, title, description, requirements, budget_type, 
         budget_min, budget_max, duration, experience_level, deadline, 
         contact_info, views_count, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')
    `;

    const values = [
        client_id,
        category_id || null,
        title,
        description,
        requirements || null,
        budget_type,
        budget_min,
        budget_max,
        duration || null,
        finalExperience,
        deadline || null,
        null  // contact_info
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("❌ Job insert error:", err.message);
            return res.json({ 
                status: "error", 
                message: "Failed to create job: " + err.message 
            });
        }

        const jobId = result.insertId;

        // Insert skills if provided
        if (skills && Array.isArray(skills) && skills.length > 0) {
            const skillValues = skills.map(id => [jobId, id]);
            db.query("INSERT INTO job_skills (job_id, skill_id) VALUES ?", [skillValues], (skillErr) => {
                if (skillErr) {
                    console.error("❌ Skills insert error:", skillErr);
                }
            });
        }

        console.log(`✅ Job posted successfully! ID: ${jobId}`);
        res.json({
            status: "success",
            message: "Job posted successfully!",
            job_id: jobId
        });
    });
});

/**
 * POST A JOB - Legacy endpoint (use /create instead)
 * POST /jobs/post
 */
router.post("/post", (req, res) => {
    console.log("🔥 POST /jobs/post called");
    console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
    
    const { 
        client_id, title, description, requirements, category_id,
        budget_min, budget_max, budget_type, duration,
        experience_level, deadline, skills
    } = req.body;

    // Detailed validation
    if (!client_id) {
        console.error("❌ Missing client_id");
        return res.json({ 
            status: "error", 
            message: "Client ID is required. Please login again." 
        });
    }

    if (!title) {
        console.error("❌ Missing title");
        return res.json({ 
            status: "error", 
            message: "Job title is required" 
        });
    }

    if (!description) {
        console.error("❌ Missing description");
        return res.json({ 
            status: "error", 
            message: "Job description is required" 
        });
    }

    console.log("✅ Basic validation passed");
    console.log(`👤 Client ID: ${client_id}`);
    console.log(`📝 Title: ${title}`);

    // Check if user exists and is a client
    const checkUserSql = "SELECT user_id, role FROM users WHERE user_id = ?";
    
    db.query(checkUserSql, [client_id], (err, userResult) => {
        if (err) {
            console.error("❌ Database error checking user:", err);
            return res.json({ 
                status: "error", 
                message: "Database error: " + err.message
            });
        }

        console.log("🔍 User check result:", userResult);

        if (!userResult || userResult.length === 0) {
            console.error("❌ User not found with ID:", client_id);
            return res.json({ 
                status: "error", 
                message: "User not found. Please login again." 
            });
        }

        const user = userResult[0];
        console.log("✅ User found:", user);

        if (user.role !== 'client') {
            console.error("❌ User is not a client. Role:", user.role);
            return res.json({ 
                status: "error", 
                message: "Only clients can post jobs. Your role: " + user.role 
            });
        }

        console.log("✅ User is a valid client. Proceeding with job insert...");

        // Map experience level
        const finalExperience = expLevelMap[experience_level] || "intermediate";

        // Insert job
        const insertJobSql = `
            INSERT INTO jobs (
                client_id, title, description, requirements, category_id,
                budget_min, budget_max, budget_type, duration,
                experience_level, deadline, status, contact_info
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '')
        `;

        const jobValues = [
            client_id, 
            title, 
            description, 
            requirements || null, 
            category_id || null,
            budget_min || null, 
            budget_max || null, 
            budget_type || 'fixed',
            duration || null, 
            finalExperience, 
            deadline || null
        ];

        console.log("🔍 Job values:", jobValues);

        db.query(insertJobSql, jobValues, (err, result) => {
            if (err) {
                console.error("❌ Job insert error:", err);
                console.error("❌ Error code:", err.code);
                console.error("❌ Error SQL:", err.sql);
                return res.json({ 
                    status: "error", 
                    message: "Failed to post job: " + err.message,
                    error: err.code
                });
            }

            const jobId = result.insertId;
            console.log(`✅ Job inserted successfully with ID: ${jobId}`);

            // Insert skills if provided
            if (skills && Array.isArray(skills) && skills.length > 0) {
                console.log(`🔧 Adding ${skills.length} skills...`);
                const skillValues = skills.map(skillId => [jobId, skillId]);
                const skillSql = "INSERT INTO job_skills (job_id, skill_id) VALUES ?";
                
                db.query(skillSql, [skillValues], (err) => {
                    if (err) {
                        console.error("❌ Skills insert error:", err);
                    } else {
                        console.log(`✅ Added ${skills.length} skills to job`);
                    }
                });
            }

            console.log(`✅ ✅ ✅ JOB POSTED SUCCESSFULLY: ${title} (ID: ${jobId})`);
            res.json({ 
                status: "success", 
                message: "Job posted successfully!",
                jobId: jobId
            });
        });
    });
});

/**
 * GET ALL PROPOSALS FOR A JOB
 * GET /jobs/proposals/:job_id
 * ⚠️ Must come BEFORE /:job_id route
 */
router.get("/proposals/:job_id", (req, res) => {
    const { job_id } = req.params;
    console.log(`🔥 GET /jobs/proposals/${job_id} called`);

    const sql = `
        SELECT 
            p.*,
            u.name as freelancer_name,
            u.email as freelancer_email,
            u.profile_picture as freelancer_avatar
        FROM proposals p
        LEFT JOIN users u ON p.freelancer_id = u.user_id
        WHERE p.job_id = ?
        ORDER BY p.created_at DESC
    `;

    db.query(sql, [job_id], (err, proposals) => {
        if (err) {
            console.error("❌ Get proposals error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch proposals" 
            });
        }

        console.log(`✅ Found ${proposals.length} proposals for job ${job_id}`);
        res.json({ 
            status: "success", 
            proposals: proposals 
        });
    });
});

/**
 * GET PROPOSALS BY FREELANCER (My Proposals)
 * GET /jobs/proposals/my/:freelancer_id
 */
router.get("/proposals/my/:freelancer_id", (req, res) => {
    const { freelancer_id } = req.params;
    console.log(`🔥 GET /jobs/proposals/my/${freelancer_id} called`);

    const sql = `
        SELECT 
            p.proposal_id,
            p.job_id,
            p.cover_letter,
            p.proposed_budget,
            p.proposed_duration,
            p.status,
            p.created_at as submitted_at,
            j.title as job_title,
            j.description as job_description,
            j.budget_min,
            j.budget_max,
            j.duration,
            u.name as client_name,
            u.email as client_email
        FROM proposals p
        LEFT JOIN jobs j ON p.job_id = j.job_id
        LEFT JOIN users u ON j.client_id = u.user_id
        WHERE p.freelancer_id = ?
        ORDER BY p.created_at DESC
    `;

    db.query(sql, [freelancer_id], (err, proposals) => {
        if (err) {
            console.error("❌ Get freelancer proposals error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch proposals" 
            });
        }

        console.log(`✅ Found ${proposals.length} proposals by freelancer ${freelancer_id}`);
        res.json({ 
            status: "success", 
            proposals: proposals 
        });
    });
});

/**
 * SUBMIT PROPOSAL
 * POST /jobs/proposal/submit
 */
router.post("/proposal/submit", (req, res) => {
    console.log("🔥 POST /jobs/proposal/submit called");
    
    const { job_id, freelancer_id, cover_letter, proposed_budget, proposed_duration } = req.body;

    if (!job_id || !freelancer_id || !cover_letter || !proposed_budget) {
        return res.json({ 
            status: "error", 
            message: "All required fields must be filled" 
        });
    }

    // Check if already submitted
    const checkSql = "SELECT * FROM proposals WHERE job_id = ? AND freelancer_id = ?";
    db.query(checkSql, [job_id, freelancer_id], (err, result) => {
        if (err) {
            return res.json({ status: "error", message: "Database error" });
        }

        if (result.length > 0) {
            return res.json({ 
                status: "error", 
                message: "You have already submitted a proposal for this job" 
            });
        }

        const sql = `
            INSERT INTO proposals (job_id, freelancer_id, cover_letter, proposed_budget, proposed_duration)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(sql, [job_id, freelancer_id, cover_letter, proposed_budget, proposed_duration || null], (err, result) => {
            if (err) {
                console.error("❌ Proposal submit error:", err);
                return res.json({ 
                    status: "error", 
                    message: "Failed to submit proposal" 
                });
            }

            console.log(`✅ Proposal submitted for job ${job_id}`);
            res.json({ 
                status: "success", 
                message: "Proposal submitted successfully",
                proposalId: result.insertId
            });
        });
    });
});

/**
 * ACCEPT PROPOSAL & ASSIGN JOB
 * POST /jobs/proposal/accept
 */
router.post("/proposal/accept", (req, res) => {
    console.log("🔥 POST /jobs/proposal/accept called");
    
    const { proposal_id, job_id, freelancer_id } = req.body;

    if (!proposal_id || !job_id || !freelancer_id) {
        return res.json({ 
            status: "error", 
            message: "Proposal ID, Job ID, and Freelancer ID are required" 
        });
    }

    // Start transaction-like updates
    
    // 1. Update the accepted proposal
    const acceptSql = "UPDATE proposals SET status = 'accepted' WHERE proposal_id = ?";
    
    db.query(acceptSql, [proposal_id], (err) => {
        if (err) {
            console.error("❌ Accept proposal error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to accept proposal" 
            });
        }

        // 2. Reject all other proposals for this job
        const rejectOthersSql = "UPDATE proposals SET status = 'rejected' WHERE job_id = ? AND proposal_id != ?";
        
        db.query(rejectOthersSql, [job_id, proposal_id], (err) => {
            if (err) {
                console.error("❌ Reject other proposals error:", err);
            }

            // 3. Update job status to 'in-progress' and assign freelancer
            const updateJobSql = "UPDATE jobs SET status = 'in-progress', assigned_freelancer_id = ? WHERE job_id = ?";
            
            db.query(updateJobSql, [freelancer_id, job_id], (err) => {
                if (err) {
                    console.error("❌ Update job error:", err);
                    return res.json({ 
                        status: "error", 
                        message: "Proposal accepted but job update failed" 
                    });
                }

                console.log(`✅ Proposal ${proposal_id} accepted for job ${job_id}`);
                res.json({ 
                    status: "success", 
                    message: "Freelancer hired successfully! Job is now in progress." 
                });
            });
        });
    });
});

/**
 * REJECT PROPOSAL
 * POST /jobs/proposal/reject
 */
router.post("/proposal/reject", (req, res) => {
    console.log("🔥 POST /jobs/proposal/reject called");
    
    const { proposal_id } = req.body;

    if (!proposal_id) {
        return res.json({ 
            status: "error", 
            message: "Proposal ID is required" 
        });
    }

    const sql = "UPDATE proposals SET status = 'rejected' WHERE proposal_id = ?";
    
    db.query(sql, [proposal_id], (err, result) => {
        if (err) {
            console.error("❌ Reject proposal error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to reject proposal" 
            });
        }

        if (result.affectedRows === 0) {
            return res.json({ 
                status: "error", 
                message: "Proposal not found" 
            });
        }

        console.log(`✅ Proposal ${proposal_id} rejected`);
        res.json({ 
            status: "success", 
            message: "Proposal rejected successfully" 
        });
    });
});

/**
 * WITHDRAW PROPOSAL (Freelancer)
 * POST /jobs/proposal/withdraw
 */
router.post("/proposal/withdraw", (req, res) => {
    console.log("🔥 POST /jobs/proposal/withdraw called");
    
    const { proposal_id } = req.body;

    if (!proposal_id) {
        return res.json({ 
            status: "error", 
            message: "Proposal ID is required" 
        });
    }

    // Delete the proposal instead of updating status
    const sql = "DELETE FROM proposals WHERE proposal_id = ? AND status = 'pending'";
    
    db.query(sql, [proposal_id], (err, result) => {
        if (err) {
            console.error("❌ Withdraw proposal error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to withdraw proposal" 
            });
        }

        if (result.affectedRows === 0) {
            return res.json({ 
                status: "error", 
                message: "Proposal not found or already processed" 
            });
        }

        console.log(`✅ Proposal ${proposal_id} withdrawn`);
        res.json({ 
            status: "success", 
            message: "Proposal withdrawn successfully" 
        });
    });
});

/**
 * SAVE/BOOKMARK JOB
 * POST /jobs/save
 */
router.post("/save", (req, res) => {
    console.log("🔥 POST /jobs/save called");
    
    const { user_id, job_id } = req.body;

    if (!user_id || !job_id) {
        return res.json({ 
            status: "error", 
            message: "User ID and Job ID are required" 
        });
    }

    // Check if already saved
    const checkSql = "SELECT * FROM saved_jobs WHERE user_id = ? AND job_id = ?";
    db.query(checkSql, [user_id, job_id], (err, result) => {
        if (err) {
            return res.json({ status: "error", message: "Database error" });
        }

        if (result.length > 0) {
            // Already saved, remove it
            const deleteSql = "DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?";
            db.query(deleteSql, [user_id, job_id], (err) => {
                if (err) {
                    return res.json({ status: "error", message: "Failed to unsave job" });
                }
                res.json({ status: "success", message: "Job removed from saved jobs" });
            });
        } else {
            // Not saved yet, save it
            const insertSql = "INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)";
            db.query(insertSql, [user_id, job_id], (err) => {
                if (err) {
                    return res.json({ status: "error", message: "Failed to save job" });
                }
                res.json({ status: "success", message: "Job saved successfully" });
            });
        }
    });
});

/**
 * DELETE JOB
 * DELETE /jobs/delete/:job_id
 */
router.delete("/delete/:job_id", (req, res) => {
    const { job_id } = req.params;
    console.log(`🔥 DELETE /jobs/delete/${job_id} called`);

    if (!job_id) {
        return res.json({ 
            status: "error", 
            message: "Job ID is required" 
        });
    }

    const sql = "DELETE FROM jobs WHERE job_id = ?";
    
    db.query(sql, [job_id], (err, result) => {
        if (err) {
            console.error("❌ Delete job error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to delete job" 
            });
        }

        if (result.affectedRows === 0) {
            return res.json({ 
                status: "error", 
                message: "Job not found" 
            });
        }

        console.log(`✅ Job deleted: ${job_id}`);
        res.json({ 
            status: "success", 
            message: "Job deleted successfully" 
        });
    });
});

/**
 * GET SINGLE JOB BY ID
 * ⚠️ IMPORTANT: This must be LAST because it's a parameterized route
 * GET /jobs/:job_id
 */
router.get("/:job_id", (req, res) => {
    const { job_id } = req.params;
    console.log(`🔥 GET /jobs/${job_id} called`);

    const sql = `
        SELECT 
            j.*,
            u.name as client_name,
            u.email as client_email,
            u.user_id as client_id,
            COALESCE(j.views_count, 0) as views_count
        FROM jobs j
        LEFT JOIN users u ON j.client_id = u.user_id
        WHERE j.job_id = ?
    `;
    
    db.query(sql, [job_id], (err, result) => {
        if (err) {
            console.error("❌ Get job error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch job" 
            });
        }

        if (result.length === 0) {
            return res.json({ 
                status: "error", 
                message: "Job not found" 
            });
        }

        const job = result[0];

        // Get proposal count
        db.query(
            "SELECT COUNT(*) as count FROM proposals WHERE job_id = ?",
            [job_id],
            (err, propResult) => {
                if (!err && propResult.length > 0) {
                    job.proposal_count = propResult[0].count;
                } else {
                    job.proposal_count = 0;
                }

                // Get required skills
                db.query(
                    `SELECT s.skill_id, s.skill_name 
                     FROM job_skills js
                     JOIN skills s ON js.skill_id = s.skill_id
                     WHERE js.job_id = ?`,
                    [job_id],
                    (err, skills) => {
                        job.required_skills = skills || [];
                        
                        // Get category name
                        if (job.category_id) {
                            db.query(
                                "SELECT category_name FROM job_categories WHERE category_id = ?",
                                [job.category_id],
                                (err, catResult) => {
                                    if (!err && catResult.length > 0) {
                                        job.category_name = catResult[0].category_name;
                                    }
                                    
                                    // Increment view count
                                    db.query("UPDATE jobs SET views_count = COALESCE(views_count, 0) + 1 WHERE job_id = ?", [job_id]);
                                    
                                    res.json({
                                        status: "success",
                                        job: job
                                    });
                                }
                            );
                        } else {
                            // Increment view count
                            db.query("UPDATE jobs SET views_count = COALESCE(views_count, 0) + 1 WHERE job_id = ?", [job_id]);
                            
                            res.json({
                                status: "success",
                                job: job
                            });
                        }
                    }
                );
            }
        );
    });
});

console.log("✅ Jobs routes configured");

module.exports = router;