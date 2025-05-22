// src/handlers/libraryAdmin.js
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin } from '../utils/authHelper.js'; // 确保引入
import { getPaginationParams, formatPaginatedResponse } from '../utils/paginationHelper.js'; // <--- 引入

async function handleBorrowedRecords(request, env) {
    console.log("[handleBorrowedRecords] Request received.");
    try {
        const { page, limit, offset } = getPaginationParams(request.url, 15); // 默认每页 15 条记录
        const url = new URL(request.url);
        
        let conditions = [];
        let queryParams = [];
        // JOINs to allow searching by username or book title
        let joins = `JOIN users u ON bb.user_id = u.id JOIN books b ON bb.isbn = b.isbn`;

        if (url.searchParams.get('user_id')) { conditions.push("bb.user_id = ?"); queryParams.push(url.searchParams.get('user_id')); }
        if (url.searchParams.get('isbn')) { conditions.push("bb.isbn = ?"); queryParams.push(url.searchParams.get('isbn')); }
        if (url.searchParams.get('returned')) { conditions.push("bb.returned = ?"); queryParams.push(parseInt(url.searchParams.get('returned'))); }
        if (url.searchParams.get('current') === '1') { conditions.push("bb.returned = 0"); }

        // 新增搜索功能
        const searchTerm = url.searchParams.get('search');
        if (searchTerm) {
            conditions.push("(u.username LIKE ? OR u.email LIKE ? OR u.id = ? OR b.title LIKE ? OR bb.isbn LIKE ?)");
            const searchLike = `%${searchTerm}%`;
            // 尝试将 searchTerm 也作为数字进行比较 (针对 user_id)
            const searchNumeric = parseInt(searchTerm); 
            queryParams.push(searchLike, searchLike, isNaN(searchNumeric) ? -1 : searchNumeric, searchLike, searchLike); // -1 for non-numeric search on ID
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const countSql = `SELECT COUNT(bb.id) as total FROM borrowed_books bb ${joins} ${whereClause}`;
        console.log("[handleBorrowedRecords] Count SQL:", countSql, "Params:", JSON.stringify(queryParams));
        const countResult = await env.DB.prepare(countSql).bind(...queryParams).first();
        const totalItems = countResult ? countResult.total : 0;
        console.log("[handleBorrowedRecords] Total items found:", totalItems);

        const dataSql = `
            SELECT bb.*, u.username, b.title as book_title 
            FROM borrowed_books bb 
            ${joins} 
            ${whereClause} 
            ORDER BY bb.borrow_date DESC LIMIT ? OFFSET ?`;
        const dataQueryParams = [...queryParams, limit, offset];
        console.log("[handleBorrowedRecords] Data SQL:", dataSql, "Params:", JSON.stringify(dataQueryParams));
        const { results: records } = await env.DB.prepare(dataSql).bind(...dataQueryParams).all();

        console.log(`[handleBorrowedRecords] Found ${records ? records.length : 0} records for current page.`);
        return new Response(JSON.stringify(formatPaginatedResponse(records, totalItems, page, limit)), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[handleBorrowedRecords] Error:", error.message, error.stack);
        return createErrorResponse("Server Error fetching borrowed records: " + error.message, 500);
    }
}

async function handleOverdue(request, env) {
    console.log("[handleOverdue] Request received.");
    try {
        const { page, limit, offset } = getPaginationParams(request.url, 15);
        const today = new Date().toISOString().slice(0, 10);
        
        // WHERE 条件总是固定的
        const whereClause = "WHERE bb.due_date < ? AND bb.returned = 0";
        const baseQueryParams = [today];

        const countSql = `SELECT COUNT(bb.id) as total FROM borrowed_books bb ${whereClause}`;
        console.log("[handleOverdue] Count SQL:", countSql, "Params:", JSON.stringify(baseQueryParams));
        const countResult = await env.DB.prepare(countSql).bind(...baseQueryParams).first();
        const totalItems = countResult ? countResult.total : 0;
        console.log("[handleOverdue] Total items found:", totalItems);

        const dataSql = `
            SELECT bb.*, u.username, b.title as book_title 
            FROM borrowed_books bb 
            JOIN users u ON bb.user_id = u.id 
            JOIN books b ON bb.isbn = b.isbn 
            ${whereClause} 
            ORDER BY bb.due_date ASC LIMIT ? OFFSET ?`;
        const dataQueryParams = [...baseQueryParams, limit, offset];
        console.log("[handleOverdue] Data SQL:", dataSql, "Params:", JSON.stringify(dataQueryParams));
        const { results: records } = await env.DB.prepare(dataSql).bind(...dataQueryParams).all();

        console.log(`[handleOverdue] Found ${records ? records.length : 0} records for current page.`);
        return new Response(JSON.stringify(formatPaginatedResponse(records, totalItems, page, limit)), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[handleOverdue] Error:", error.message, error.stack);
        return createErrorResponse("Server Error fetching overdue records: " + error.message, 500);
    }
}

export async function handleBookStatus(request, env) {
    console.log("[handleBookStatus] Request received to get books by status.");

    // 权限验证 (确保只有管理员可以访问)
    // const adminVerification = await verifyAdmin(request, env); // 这一行应该在 handleAdminLibrary 中统一处理
    // if (!adminVerification.authorized) {
    //     return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    // }

    try {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');

        if (!status || typeof status !== 'string' || status.trim() === '') {
            console.warn("[handleBookStatus] 'status' query parameter is required.");
            return createErrorResponse("Query parameter 'status' is required.", 400);
        }
        const trimmedStatus = status.trim();
        console.log(`[handleBookStatus] Filtering books by status: "${trimmedStatus}"`);

        // 获取分页参数
        const { page, limit, offset } = getPaginationParams(request.url, 15); // 默认每页 15 本书

        // 构建查询条件和参数
        const conditions = ["status = ?"];
        const queryParams = [trimmedStatus];
        const whereClause = `WHERE ${conditions.join(" AND ")}`; // 只有一个条件

        // 1. 获取符合条件的总书籍数
        const countSql = `SELECT COUNT(*) as total FROM books ${whereClause}`;
        console.log("[handleBookStatus] Count SQL:", countSql, "Params:", JSON.stringify(queryParams));
        const countResult = await env.DB.prepare(countSql).bind(...queryParams).first();
        const totalItems = countResult ? countResult.total : 0;
        console.log(`[handleBookStatus] Total books found with status "${trimmedStatus}": ${totalItems}`);

        // 2. 获取当前页的数据
        // 包含了 category_name 以便前端显示
        const dataSql = `
            SELECT b.*, c.name as category_name 
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            ${whereClause} 
            ORDER BY b.title ASC 
            LIMIT ? OFFSET ?`;
        const dataQueryParams = [...queryParams, limit, offset];
        console.log("[handleBookStatus] Data SQL:", dataSql, "Params:", JSON.stringify(dataQueryParams));
        const { results: books } = await env.DB.prepare(dataSql).bind(...dataQueryParams).all();

        console.log(`[handleBookStatus] Found ${books ? books.length : 0} books for status "${trimmedStatus}" on page ${page}.`);
        return new Response(JSON.stringify(formatPaginatedResponse(books, totalItems, page, limit)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("[handleBookStatus] Error:", error.message, error.stack);
        return createErrorResponse("Server Error while fetching books by status: " + error.message, 500);
    }
}

export async function handleAdminLibrary(request, env) {
    console.log("[handleAdminLibrary] Received admin library request.");
    
    // 统一进行管理员权限验证
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        console.warn("[handleAdminLibrary] Admin verification failed:", adminVerification.error);
        // 根据 verifyAdmin 返回的错误类型决定状态码
        const statusCode = adminVerification.error.toLowerCase().includes('unauthorized') ? 401 : 403;
        return createErrorResponse(adminVerification.error, statusCode);
    }
    console.log("[handleAdminLibrary] Admin verified.");

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    console.log(`[handleAdminLibrary] Action requested: "${action}"`);

    try {
        switch (action) {
            case 'borrowed_records':
                console.log("[handleAdminLibrary] Dispatching to handleBorrowedRecords.");
                return await handleBorrowedRecords(request, env);
            case 'overdue':
                console.log("[handleAdminLibrary] Dispatching to handleOverdue.");
                return await handleOverdue(request, env);
            case 'book_status': 
                console.log("[handleAdminLibrary] Dispatching to handleBookStatus.");
                return await handleBookStatus(request, env);
            default:
                console.warn(`[handleAdminLibrary] Invalid action: "${action}"`);
                return createErrorResponse(`Invalid action parameter: "${action}". Allowed actions are: borrowed_records, overdue, book_status.`, 400);
        }
    } catch (error) {
        // 这个 catch 块主要捕获 switch 内部或子 handler 未捕获的意外错误
        console.error("[handleAdminLibrary] Unexpected error during action dispatch:", error.message, error.stack);
        return createErrorResponse("Server Error in library admin operation: " + error.message, 500);
    }
}