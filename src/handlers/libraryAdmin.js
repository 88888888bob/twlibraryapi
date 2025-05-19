// src/handlers/libraryAdmin.js
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin } from '../utils/authHelper.js'; // 确保引入

async function handleBorrowedRecords(request, env) {
    const url = new URL(request.url);
    const params = [];
    let query = `
        SELECT bb.*, u.username, b.title as book_title 
        FROM borrowed_books bb 
        JOIN users u ON bb.user_id = u.id 
        JOIN books b ON bb.isbn = b.isbn 
        WHERE 1=1`;

    if (url.searchParams.get('user_id')) { query += " AND bb.user_id = ?"; params.push(url.searchParams.get('user_id')); }
    if (url.searchParams.get('isbn')) { query += " AND bb.isbn = ?"; params.push(url.searchParams.get('isbn')); }
    if (url.searchParams.get('returned')) { query += " AND bb.returned = ?"; params.push(parseInt(url.searchParams.get('returned'))); }
    if (url.searchParams.get('current') === '1') { query += " AND bb.returned = 0"; }
    query += " ORDER BY bb.borrow_date DESC";

    try {
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify({ success: true, results: results || [] }), { status: 200 });
    } catch (error) {
        console.error("Borrowed Records Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

async function handleOverdue(request, env) {
    const today = new Date().toISOString().slice(0, 10);
    const query = `
        SELECT bb.*, u.username, b.title as book_title 
        FROM borrowed_books bb 
        JOIN users u ON bb.user_id = u.id 
        JOIN books b ON bb.isbn = b.isbn 
        WHERE bb.due_date < ? AND bb.returned = 0 
        ORDER BY bb.due_date ASC`;
    try {
        const { results } = await env.DB.prepare(query).bind(today).all();
        return new Response(JSON.stringify({ success: true, results: results || [] }), { status: 200 });
    } catch (error) {
        console.error("Overdue Records Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

async function handleBookStatus(request, env) { // 这个函数的功能可能与 handleSearchBook 中的 status 过滤重叠
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    if (!status) return createErrorResponse("Status parameter required.", 400);
    
    const query = "SELECT * FROM books WHERE status = ?";
    try {
        const { results } = await env.DB.prepare(query).bind(status).all();
        return new Response(JSON.stringify({ success: true, results: results || [] }), { status: 200 });
    } catch (error) {
        console.error("Book Status Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleAdminLibrary(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    try {
        switch (action) {
            case 'borrowed_records':
                return await handleBorrowedRecords(request, env);
            case 'overdue':
                return await handleOverdue(request, env);
            case 'book_status': // 确保前端确实需要这个独立的接口
                return await handleBookStatus(request, env);
            default:
                return createErrorResponse("Invalid action for managebooks.", 400);
        }
    } catch (error) { // General catch for unexpected errors in switch or sub-handlers if they don't catch
        console.error("Admin Library API Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}