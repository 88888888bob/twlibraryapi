// src/handlers/stats.js
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin, verifyUser } from '../utils/authHelper.js';

export async function handleGetTopBorrowers(request, env) {
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) return createErrorResponse(userVerification.error, 401);
    try {
        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days')) || 30;
        const limit = parseInt(url.searchParams.get('limit')) || 10;
        if (days <= 0 || limit <= 0) return createErrorResponse("'days' and 'limit' must be positive.", 400);

        const dateNdaysAgo = new Date();
        dateNdaysAgo.setDate(dateNdaysAgo.getDate() - days);
        const startDate = dateNdaysAgo.toISOString().split('T')[0];

        const query = `
            SELECT u.id AS user_id, u.username, u.email, COUNT(bb.id) AS borrow_count
            FROM borrowed_books bb JOIN users u ON bb.user_id = u.id
            WHERE bb.borrow_date >= ?
            GROUP BY u.id, u.username, u.email
            ORDER BY borrow_count DESC LIMIT ?`;
        
        const { results } = await env.DB.prepare(query).bind(startDate, limit).all();
        return new Response(JSON.stringify({ success: true, topBorrowers: results || [] }), { status: 200 });
    } catch (error) {
        console.error("Top Borrowers Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleAdminGetStats(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    try {
        const counts = await env.DB.batch([
            env.DB.prepare("SELECT COUNT(*) as count FROM books"),
            env.DB.prepare("SELECT COUNT(*) as count FROM users"),
            env.DB.prepare("SELECT COUNT(*) as count FROM borrowed_books WHERE returned = 0"),
            env.DB.prepare("SELECT COUNT(*) as count FROM borrowed_books WHERE due_date < date('now') AND returned = 0"),
            env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE created_at >= date('now', '-7 days')")
        ]);
        
        const stats = {
            totalBooks: counts[0].results[0]?.count || 0,
            totalUsers: counts[1].results[0]?.count || 0,
            currentBorrows: counts[2].results[0]?.count || 0,
            overdueBorrows: counts[3].results[0]?.count || 0,
            newUsersLast7Days: counts[4].results[0]?.count || 0,
        };
        return new Response(JSON.stringify({ success: true, stats }), { status: 200 });
    } catch (error) {
        console.error("Admin Stats Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}