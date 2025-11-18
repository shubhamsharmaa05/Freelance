const mysql = require("mysql2");  // "mysql" ki jagah "mysql2"

// Database configuration
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1235", // Yaha apna MySQL password dalein (agar hai toh)
    database: "freelancehub",
    charset: "utf8mb4"
});

// Connect to database
db.connect((err) => {
    if (err) {
        console.error("❌ MySQL Connection Error:", err.message);
        console.error("\n🔧 Troubleshooting Tips:");
        console.error("1. Check if MySQL server is running");
        console.error("2. Verify database 'freelancehub' exists");
        console.error("3. Check username and password");
        console.error("4. Make sure MySQL is running on port 3306\n");
        throw err;
    }
    console.log("✅ MySQL Connected Successfully");
    console.log("📊 Database: freelancehub");
    console.log("🔗 Host: localhost\n");
});

// Handle connection errors
db.on('error', (err) => {
    console.error("❌ MySQL Error:", err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error("💔 Database connection was closed.");
        console.error("   Attempting to reconnect...");
        // You can add reconnection logic here if needed
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
        console.error("⚠️  Database has too many connections.");
    }
    if (err.code === 'ECONNREFUSED') {
        console.error("🚫 Database connection was refused.");
        console.error("   Make sure MySQL server is running!");
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.end((err) => {
        if (err) {
            console.error("Error closing database:", err);
        } else {
            console.log("\n👋 Database connection closed.");
        }
        process.exit(0);
    });
});

module.exports = db;