const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const authRoutes = require("./routes/auth");
const jobRoutes = require("./routes/jobs");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/auth", authRoutes);
app.use("/jobs", jobRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        status: "error", 
        message: "Something went wrong!" 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        status: "error", 
        message: "Route not found" 
    });
});

const PORT = 5500;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});

module.exports = app;