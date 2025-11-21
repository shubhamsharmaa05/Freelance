const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db");

const app = express();
const PORT = 5500;

// Middleware
const corsOptions = {
    origin: [
        'http://localhost:5500',
        'http://localhost:5501',
        'http://localhost:5502',
        'http://127.0.0.1:5500',
        'http://127.0.0.1:5501',
        'http://127.0.0.1:5502'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Log all requests
app.use((req, res, next) => {
    console.log(`🔥 ${req.method} ${req.path}`);
    next();
});

// Import Routes
const authRoutes = require("./routes/auth");
const jobRoutes = require("./routes/jobs");
const messageRoutes = require("./routes/messages");
const walletRoutes = require("./routes/wallet");

// Use Routes
app.use("/auth", authRoutes);
app.use("/jobs", jobRoutes);
app.use("/messages", messageRoutes);
app.use("/wallet", walletRoutes);
app.use("/wallets", walletRoutes); // Both /wallet and /wallets

// Test route
app.get("/api", (req, res) => {
    res.json({ 
        status: "success", 
        message: "Freelance Hub API is running!",
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get("/health", (req, res) => {
    db.query("SELECT 1", (err) => {
        if (err) {
            return res.status(500).json({ 
                status: "error", 
                message: "Database connection failed" 
            });
        }
        res.json({ 
            status: "success", 
            message: "Server and database are healthy" 
        });
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        status: "error", 
        message: "Route not found" 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err);
    res.status(500).json({ 
        status: "error", 
        message: "Internal server error" 
    });
});

// ================== UPDATE JOB API ==================
app.post("/jobs/update", async (req, res) => {
    console.log("📌 Update Job Request Received:", req.body);

    const { job_id, title, description, budget_min, budget_max } = req.body;

    if (!job_id) {
        return res.json({
            status: "error",
            message: "job_id is required"
        });
    }

    try {
        const sql = `
            UPDATE jobs SET 
                title = ?, 
                description = ?, 
                budget_min = ?, 
                budget_max = ?
            WHERE job_id = ?
        `;

        const params = [
            title || null,
            description || null,
            budget_min || 0,
            budget_max || 0,
            job_id
        ];

        db.query(sql, params, (err, result) => {
            if (err) {
                console.error("❌ Update Job Error:", err);
                return res.json({
                    status: "error",
                    message: "Database error",
                    error: err
                });
            }

            if (result.affectedRows === 0) {
                return res.json({
                    status: "error",
                    message: "Invalid job_id or job not found"
                });
            }

            return res.json({
                status: "success",
                message: "Job updated successfully"
            });
        });

    } catch (error) {
        console.error("❌ Server error:", error);
        return res.json({
            status: "error",
            message: "Server error"
        });
    }
});


// Start server
app.listen(PORT, () => {
    console.log("\n🚀 ====================================");
    console.log("🎉 Freelance Hub Backend Started!");
    console.log("🚀 ====================================");
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/api`);
    console.log(`💊 Health check: http://localhost:${PORT}/health`);
    console.log("🚀 ====================================\n");
});

module.exports = app;