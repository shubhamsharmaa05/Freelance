const express = require("express");
const router = express.Router();
const db = require("../db");

console.log("✅ Wallet routes loaded");

/**
 * GET WALLET BALANCE
 * GET /wallets/:user_id
 */
router.get("/:user_id", (req, res) => {
    const { user_id } = req.params;
    console.log(`🔥 GET /wallets/${user_id} called`);

    const sql = "SELECT * FROM wallets WHERE user_id = ?";
    
    db.query(sql, [user_id], (err, result) => {
        if (err) {
            console.error("❌ Get wallet error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch wallet" 
            });
        }

        if (result.length === 0) {
            // Create wallet if doesn't exist
            const createSql = "INSERT INTO wallets (user_id, balance) VALUES (?, 0.00)";
            db.query(createSql, [user_id], (createErr, createResult) => {
                if (createErr) {
                    console.error("❌ Create wallet error:", createErr);
                    return res.json({ 
                        status: "error", 
                        message: "Failed to create wallet" 
                    });
                }
                
                res.json({
                    status: "success",
                    wallet: {
                        wallet_id: createResult.insertId,
                        user_id: user_id,
                        balance: 0.00,
                        created_at: new Date()
                    }
                });
            });
        } else {
            console.log(`✅ Wallet balance: ${result[0].balance}`);
            res.json({
                status: "success",
                wallet: result[0]
            });
        }
    });
});

/**
 * GET WALLET TRANSACTIONS
 * GET /wallets/:user_id/transactions
 */
router.get("/:user_id/transactions", (req, res) => {
    const { user_id } = req.params;
    console.log(`🔥 GET /wallets/${user_id}/transactions called`);

    const sql = `
        SELECT * FROM wallet_transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
    `;
    
    db.query(sql, [user_id], (err, result) => {
        if (err) {
            console.error("❌ Get transactions error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to fetch transactions" 
            });
        }

        console.log(`✅ Found ${result.length} transactions`);
        res.json({
            status: "success",
            transactions: result
        });
    });
});

/**
 * TOP UP WALLET
 * POST /wallets/topup
 */
router.post("/topup", (req, res) => {
    console.log("🔥 POST /wallets/topup called");
    
    const { user_id, amount, method } = req.body;

    if (!user_id || !amount || amount <= 0) {
        return res.json({ 
            status: "error", 
            message: "Valid user_id and amount required" 
        });
    }

    // Update wallet balance
    const updateSql = `
        UPDATE wallets 
        SET balance = balance + ?, 
            updated_at = NOW() 
        WHERE user_id = ?
    `;
    
    db.query(updateSql, [amount, user_id], (err, result) => {
        if (err) {
            console.error("❌ Top up error:", err);
            return res.json({ 
                status: "error", 
                message: "Failed to add funds" 
            });
        }

        // Record transaction
        const txSql = `
            INSERT INTO wallet_transactions 
            (user_id, type, amount, description, status) 
            VALUES (?, 'credit', ?, ?, 'completed')
        `;
        
        db.query(txSql, [user_id, amount, `Top up via ${method}`], (txErr) => {
            if (txErr) {
                console.error("Transaction record error:", txErr);
            }
        });

        console.log(`✅ Top up successful: ${amount}`);
        res.json({ 
            status: "success", 
            message: "Funds added successfully" 
        });
    });
});

/**
 * WITHDRAW FROM WALLET
 * POST /wallets/withdraw
 */
router.post("/withdraw", (req, res) => {
    console.log("🔥 POST /wallets/withdraw called");
    
    const { user_id, amount, method, details } = req.body;

    if (!user_id || !amount || amount <= 0) {
        return res.json({ 
            status: "error", 
            message: "Valid user_id and amount required" 
        });
    }

    // Check balance
    const checkSql = "SELECT balance FROM wallets WHERE user_id = ?";
    
    db.query(checkSql, [user_id], (err, result) => {
        if (err || result.length === 0) {
            return res.json({ 
                status: "error", 
                message: "Wallet not found" 
            });
        }

        if (result[0].balance < amount) {
            return res.json({ 
                status: "error", 
                message: "Insufficient balance" 
            });
        }

        // Deduct from wallet
        const updateSql = `
            UPDATE wallets 
            SET balance = balance - ?, 
                updated_at = NOW() 
            WHERE user_id = ?
        `;
        
        db.query(updateSql, [amount, user_id], (updateErr) => {
            if (updateErr) {
                console.error("❌ Withdraw error:", updateErr);
                return res.json({ 
                    status: "error", 
                    message: "Failed to withdraw" 
                });
            }

            // Record transaction
            const txSql = `
                INSERT INTO wallet_transactions 
                (user_id, type, amount, description, status) 
                VALUES (?, 'debit', ?, ?, 'pending')
            `;
            
            db.query(txSql, [user_id, amount, `Withdrawal to ${method}: ${details}`], (txErr) => {
                if (txErr) {
                    console.error("Transaction record error:", txErr);
                }
            });

            console.log(`✅ Withdrawal requested: ${amount}`);
            res.json({ 
                status: "success", 
                message: "Withdrawal request submitted" 
            });
        });
    });
});

/**
 * TRANSFER BETWEEN USERS
 * POST /wallets/transfer
 */
router.post("/transfer", (req, res) => {
    console.log("🔥 POST /wallets/transfer called");
    
    const { from_user_id, to_user_id, amount } = req.body;

    if (!from_user_id || !to_user_id || !amount || amount <= 0) {
        return res.json({ 
            status: "error", 
            message: "Valid user IDs and amount required" 
        });
    }

    // Check sender balance
    const checkSql = "SELECT balance FROM wallets WHERE user_id = ?";
    
    db.query(checkSql, [from_user_id], (err, result) => {
        if (err || result.length === 0) {
            return res.json({ 
                status: "error", 
                message: "Sender wallet not found" 
            });
        }

        if (result[0].balance < amount) {
            return res.json({ 
                status: "error", 
                message: "Insufficient balance" 
            });
        }

        // Deduct from sender
        const deductSql = `
            UPDATE wallets 
            SET balance = balance - ?, 
                updated_at = NOW() 
            WHERE user_id = ?
        `;
        
        db.query(deductSql, [amount, from_user_id], (deductErr) => {
            if (deductErr) {
                console.error("❌ Deduct error:", deductErr);
                return res.json({ 
                    status: "error", 
                    message: "Transfer failed" 
                });
            }

            // Add to receiver
            const addSql = `
                UPDATE wallets 
                SET balance = balance + ?, 
                    updated_at = NOW() 
                WHERE user_id = ?
            `;
            
            db.query(addSql, [amount, to_user_id], (addErr) => {
                if (addErr) {
                    console.error("❌ Add error:", addErr);
                    // Rollback: add back to sender
                    db.query(deductSql, [-amount, from_user_id]);
                    return res.json({ 
                        status: "error", 
                        message: "Transfer failed" 
                    });
                }

                // Record transactions for both users
                const txSql = `
                    INSERT INTO wallet_transactions 
                    (user_id, type, amount, description, status) 
                    VALUES 
                    (?, 'debit', ?, ?, 'completed'),
                    (?, 'credit', ?, ?, 'completed')
                `;
                
                db.query(txSql, [
                    from_user_id, amount, `Transfer to user ${to_user_id}`,
                    to_user_id, amount, `Transfer from user ${from_user_id}`
                ], (txErr) => {
                    if (txErr) {
                        console.error("Transaction record error:", txErr);
                    }
                });

                console.log(`✅ Transfer successful: ${amount}`);
                res.json({ 
                    status: "success", 
                    message: "Transfer completed successfully" 
                });
            });
        });
    });
});

console.log("✅ Wallet routes configured");

module.exports = router;