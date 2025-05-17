// 导入项目 2 的依赖
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { serialize } from 'cookie';

// --- 常量 ---
const COOKIE_NAME = 'library_session'; // 统一的 Cookie 名称

// 邮箱白名单和角色映射 (来自项目 2)
const ALLOWED_DOMAINS = {
    'student.pkujx.cn': 'student',
    'pkujx.cn': 'teacher',
    'qq.com': 'student',
    'gmail.com': 'student',
    'outlook.com': 'student'
};

// --- 通用辅助函数 ---

// 通用的错误处理函数 (来自项目 1)
function createErrorResponse(message, status) {
    return new Response(JSON.stringify({ success: false, message: message }), {
        status: status,
        headers: { 'Content-Type': 'application/json' },
    });
}

// --- 项目 1: 图书管理功能 ---


// 新增：处理修改图书 API 的函数 (管理员)
async function handleEditBook(request, env, isbn) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    if (!isbn) {
        return createErrorResponse("ISBN is required in the path.", 400);
    }

    try {
        // 1. 检查图书是否存在
        const existingBook = await getBookByISBN(env, isbn);
        if (!existingBook) {
            return createErrorResponse("Book with the given ISBN not found.", 404);
        }

        // 2. 获取请求体数据
        const requestBody = await request.json();
        const { title, author, publisher, publication_date, category_id, total_copies, available_copies, status } = requestBody;

        // 3. 构建更新查询
        const updateFields = [];
        const params = [];

        if (title !== undefined) { updateFields.push("title = ?"); params.push(title); }
        if (author !== undefined) { updateFields.push("author = ?"); params.push(author); }
        if (publisher !== undefined) { updateFields.push("publisher = ?"); params.push(publisher); }
        if (publication_date !== undefined) { updateFields.push("publication_date = ?"); params.push(publication_date); } // 允许设为 null
        if (category_id !== undefined) {
            // (可选) 验证 category_id 是否存在于 categories 表
            updateFields.push("category_id = ?"); params.push(parseInt(category_id));
        }
        if (total_copies !== undefined) {
            const tc = parseInt(total_copies);
            if (isNaN(tc) || tc < 0) return createErrorResponse("Invalid total_copies value.", 400);
            updateFields.push("total_copies = ?"); params.push(tc);
        }
        if (available_copies !== undefined) {
            const ac = parseInt(available_copies);
            if (isNaN(ac) || ac < 0) return createErrorResponse("Invalid available_copies value.", 400);
             // 确保 available_copies 不大于 total_copies (如果 total_copies 也被更新，需要额外逻辑)
            if (total_copies !== undefined && ac > parseInt(total_copies)) {
                return createErrorResponse("Available copies cannot exceed total copies.", 400);
            } else if (total_copies === undefined && existingBook && ac > existingBook.total_copies) {
                 return createErrorResponse("Available copies cannot exceed current total copies.", 400);
            }
            updateFields.push("available_copies = ?"); params.push(ac);
        }
        if (status !== undefined) {
            // (可选) 验证 status 是否为允许的值
            updateFields.push("status = ?"); params.push(status);
        }

        if (updateFields.length === 0) {
            return createErrorResponse("No fields provided for update.", 400);
        }

        params.push(isbn); // For the WHERE clause

        const query = `UPDATE books SET ${updateFields.join(", ")} WHERE isbn = ?`;
        const { success, meta } = await env.DB.prepare(query).bind(...params).run();

        if (success && meta && meta.changes > 0) {
             // 获取更新后的图书信息
            const updatedBook = await getBookByISBN(env, isbn);
            return new Response(JSON.stringify({ success: true, message: 'Book updated successfully.', book: updatedBook }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            });
        } else if (meta && meta.changes === 0) {
            // 没有字段实际被更改（例如，提供的值与现有值相同）或 ISBN 不存在（虽然前面检查过）
             return createErrorResponse('No changes made to the book or book not found.', 304); // Not Modified or handle as 404
        }
        else {
            return createErrorResponse('Failed to update book.', 500);
        }

    } catch (error) {
        console.error("Edit Book API Error:", error);
        // 检查 D1 的唯一约束错误等
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
             return createErrorResponse('Update failed due to a unique constraint violation (e.g., new ISBN if you were allowing ISBN change).', 409);
        }
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}



// 检查 ISBN 是否存在的函数
async function getBookByISBN(env, isbn) {
    const { results } = await env.DB.prepare("SELECT * FROM books WHERE isbn = ? LIMIT 1").bind(isbn).all();
    return results && results.length > 0 ? results[0] : null;
}

// 添加图书的函数
async function addBook(env, bookData) {
    const { isbn, title, author, publisher, publication_date, category_id, total_copies, status } = bookData;
    try {
        await env.DB.prepare(
            "INSERT INTO books (isbn, title, author, publisher, publication_date, category_id, total_copies, available_copies, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(isbn, title, author, publisher, publication_date, category_id, total_copies, total_copies, status).run();
        return true;
    } catch (error) {
        console.error("添加图书失败：", error);
        return false;
    }
}

// 验证管理员权限的函数 (重要：被图书管理接口和项目 2 的 handlePostUser 使用)
async function verifyAdmin(request, env) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
        return { authorized: false, error: 'Unauthorized: No cookie provided' };
    }

    const cookies = cookieHeader.split(';');
    let sessionId = null;
    for (const cookie of cookies) {
        const trimmedCookie = cookie.trim(); // 去除空格
        if (trimmedCookie.startsWith(`${COOKIE_NAME}=`)) {
            sessionId = trimmedCookie.substring(`${COOKIE_NAME}=`.length);
            break;
        }
    }

    if (!sessionId) {
        return { authorized: false, error: 'Unauthorized: Invalid session cookie format' };
    }

    try {
        const { results } = await env.DB.prepare(
            "SELECT user_id, role FROM sessions WHERE id = ? AND expiry > ? LIMIT 1"
        ).bind(sessionId, Date.now()).all();

        if (!results || results.length === 0) {
            return { authorized: false, error: 'Unauthorized: Invalid or expired session' };
        }

        const session = results[0];
        if (session.role !== 'admin') {
            return { authorized: false, error: 'Forbidden: Insufficient privileges' };
        }

        return { authorized: true, userId: session.user_id, role: session.role };
    } catch (error) {
        console.error("验证管理员身份失败：", error);
        return { authorized: false, error: 'Internal Server Error: Failed to verify admin status' };
    }
}

// 处理添加图书 API 的函数
async function handleAddBook(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }
    try {
        const requestBody = await request.json();
        const { isbn, title, author, publisher, publication_date, category_id, total_copies, status } = requestBody;
        if (!isbn || !title || !category_id) {
            return createErrorResponse("Missing required fields (isbn, title, category_id)", 400);
        }
        const existingBook = await getBookByISBN(env, isbn);
        if (existingBook) {
            return createErrorResponse("ISBN already exists", 409);
        }
        const bookData = {
            isbn, title,
            author: author || null,
            publisher: publisher || null,
            publication_date: publication_date || null,
            category_id,
            total_copies: total_copies || 1,
            status: status || '在馆',
        };
        const success = await addBook(env, bookData);
        if (success) {
            return new Response(
                JSON.stringify({ success: true, message: "Book added successfully", book: bookData }),
                { status: 201, headers: { 'Content-Type': 'application/json' } }
            );
        } else {
            return createErrorResponse("Failed to add book", 500);
        }
    } catch (error) {
        console.error("添加图书 API 错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// 删除图书的函数
async function deleteBook(env, isbn) {
    try {
        await env.DB.prepare("DELETE FROM books WHERE isbn = ?").bind(isbn).run();
        return true;
    } catch (error) {
        console.error("删除图书失败：", error);
        return false;
    }
}

// 处理删除图书 API 的函数
async function handleDeleteBook(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }
    try {
        const requestBody = await request.json();
        const { isbn } = requestBody;
        if (!isbn) {
            return createErrorResponse("Missing required field (isbn)", 400);
        }
        const existingBook = await getBookByISBN(env, isbn);
        if (!existingBook) {
            return createErrorResponse("ISBN not found", 404);
        }
        const { results } = await env.DB.prepare(
            "SELECT COUNT(*) AS count FROM borrowed_books WHERE isbn = ? AND returned = 0"
        ).bind(isbn).first();
        if (results && results.count > 0) {
            return createErrorResponse("Book has unreturned borrow records and cannot be deleted", 409);
        }
        const success = await deleteBook(env, isbn);
        if (success) {
            return new Response(
                JSON.stringify({ success: true, message: "Book deleted successfully" }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        } else {
            return createErrorResponse("Failed to delete book", 500);
        }
    } catch (error) {
        console.error("删除图书 API 错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// 验证普通用户（已登录即可）
async function verifyUser(request, env) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
        return { authorized: false, error: 'Unauthorized: No cookie provided' };
    }
    const cookies = cookieHeader.split(';');
    let sessionId = null;
    for (const cookie of cookies) {
        const trimmedCookie = cookie.trim();
        if (trimmedCookie.startsWith(`${COOKIE_NAME}=`)) {
            sessionId = trimmedCookie.substring(`${COOKIE_NAME}=`.length);
            break;
        }
    }
    if (!sessionId) {
        return { authorized: false, error: 'Unauthorized: Invalid session cookie format' };
    }
    try {
        const { results: sessionResults } = await env.DB.prepare(
            "SELECT user_id, role FROM sessions WHERE id = ? AND expiry > ? LIMIT 1"
        ).bind(sessionId, Date.now()).all();

        if (!sessionResults || sessionResults.length === 0) {
            return { authorized: false, error: 'Unauthorized: Invalid or expired session' };
        }
        return { authorized: true, userId: sessionResults[0].user_id, role: sessionResults[0].role };
    } catch (error) {
        console.error("验证用户身份失败：", error);
        return { authorized: false, error: 'Internal Server Error: Failed to verify user status' };
    }
}


// 处理查找图书 API 的函数
async function handleSearchBook(request, env) {
    // 任何人都可以搜索，但需要登录
    const userVerification = await verifyUser(request, env);
     if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }

    try {
        const url = new URL(request.url);
        const isbn = url.searchParams.get('isbn');
        const title = url.searchParams.get('title');
        const author = url.searchParams.get('author');
        const category_id = url.searchParams.get('category_id');
        const status = url.searchParams.get('status');

        let query = "SELECT * FROM books WHERE 1=1";
        const params = [];

        if (isbn) { query += " AND isbn = ?"; params.push(isbn); }
        if (title) { query += " AND title LIKE ?"; params.push(`%${title}%`); }
        if (author) { query += " AND author LIKE ?"; params.push(`%${author}%`); }
        if (category_id) { query += " AND category_id = ?"; params.push(category_id); }
        if (status) { query += " AND status = ?"; params.push(status); }

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(
            JSON.stringify({ success: true, results: results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error("查找图书 API 错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// 借阅图书的函数
async function borrowBookDB(env, isbn, user_id, due_date) { // Renamed to avoid conflict
    try {
        const borrow_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        await env.DB.prepare(
            "INSERT INTO borrowed_books (isbn, user_id, borrow_date, due_date, returned) VALUES (?, ?, ?, ?, ?)"
        ).bind(isbn, user_id, borrow_date, due_date, 0).run();
        await env.DB.prepare("UPDATE books SET available_copies = available_copies - 1 WHERE isbn = ?").bind(isbn).run();
        return true;
    } catch (error) {
        console.error("借阅图书失败：", error);
        return false;
    }
}

// 处理借阅图书 API 的函数
async function handleBorrowBook(request, env) {
    const adminVerification = await verifyAdmin(request, env); // 假设只有管理员能操作借阅
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }
    try {
        const requestBody = await request.json();
        const { isbn, user_id, due_date } = requestBody;
        if (!isbn || !user_id || !due_date) {
            return createErrorResponse("Missing required fields (isbn, user_id, due_date)", 400);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
            return createErrorResponse("Invalid due_date format. Use YYYY-MM-DD", 400);
        }
        const existingBook = await getBookByISBN(env, isbn);
        if (!existingBook) { return createErrorResponse("ISBN not found", 404); }

        const { results: userResults } = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ? LIMIT 1"
        ).bind(user_id).all();
        if (!userResults || userResults.length === 0) {
            return createErrorResponse("User ID not found", 404);
        }
        if (existingBook.available_copies <= 0) {
            return createErrorResponse("No available copies of this book", 409);
        }
        const success = await borrowBookDB(env, isbn, user_id, due_date);
        if (success) {
            return new Response(
                JSON.stringify({ success: true, message: "Book borrowed successfully" }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        } else {
            return createErrorResponse("Failed to borrow book", 500);
        }
    } catch (error) {
        console.error("借阅图书 API 错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// 归还图书的函数
async function returnBookDB(env, isbn, user_id) { // Renamed
    try {
        const return_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const { changes } = await env.DB.prepare(
            "UPDATE borrowed_books SET returned = 1, return_date = ? WHERE isbn = ? AND user_id = ? AND returned = 0"
        ).bind(return_date, isbn, user_id).run();
        if (changes === 0) { return false; }
        await env.DB.prepare("UPDATE books SET available_copies = available_copies + 1 WHERE isbn = ?").bind(isbn).run();
        return true;
    } catch (error) {
        console.error("归还图书失败：", error);
        return false;
    }
}

// 处理归还图书 API 的函数
async function handleReturnBook(request, env) {
    const adminVerification = await verifyAdmin(request, env); // 假设只有管理员能操作归还
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }
    try {
        const requestBody = await request.json();
        const { isbn, user_id } = requestBody;
        if (!isbn || !user_id) {
            return createErrorResponse("Missing required fields (isbn, user_id)", 400);
        }
        const existingBook = await getBookByISBN(env, isbn);
        if (!existingBook) { return createErrorResponse("ISBN not found", 404); }

        const { results: userResults } = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ? LIMIT 1"
        ).bind(user_id).all();
        if (!userResults || userResults.length === 0) {
            return createErrorResponse("User ID not found", 404);
        }
        const { results: borrowedResults } = await env.DB.prepare(
            "SELECT id FROM borrowed_books WHERE isbn = ? AND user_id = ? AND returned = 0 LIMIT 1"
        ).bind(isbn, user_id).all();
        if (!borrowedResults || borrowedResults.length === 0) {
            return createErrorResponse("No active borrow record found for this user and book", 404);
        }
        const success = await returnBookDB(env, isbn, user_id);
        if (success) {
            return new Response(
                JSON.stringify({ success: true, message: "Book returned successfully" }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        } else {
            return createErrorResponse("Failed to return book", 500);
        }
    } catch (error) {
        console.error("归还图书 API 错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// 处理管理库 API (借阅记录、逾期、图书状态)
async function handleAdminLibrary(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }
    try {
        const url = new URL(request.url);
        const action = url.searchParams.get('action');
        switch (action) {
            case 'borrowed_records':
                return handleBorrowedRecords(request, env);
            case 'overdue':
                return handleOverdue(request, env);
            case 'book_status':
                return handleBookStatus(request, env);
            default:
                return createErrorResponse("Invalid action", 400);
        }
    } catch (error) {
        console.error("Admin Library API 错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// 处理借阅记录查询
async function handleBorrowedRecords(request, env) {
    // verifyAdmin already called in handleAdminLibrary
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const isbn = url.searchParams.get('isbn');
    const returned = url.searchParams.get('returned');
    const current = url.searchParams.get('current');

    let query = "SELECT bb.*, u.username, b.title as book_title FROM borrowed_books bb JOIN users u ON bb.user_id = u.id JOIN books b ON bb.isbn = b.isbn WHERE 1=1";
    const params = [];

    if (userId) { query += " AND bb.user_id = ?"; params.push(userId); }
    if (isbn) { query += " AND bb.isbn = ?"; params.push(isbn); }
    if (returned) { query += " AND bb.returned = ?"; params.push(returned); }
    if (current === '1') { query += " AND bb.returned = 0"; }

    try {
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(
            JSON.stringify({ success: true, results: results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error("借阅记录查询错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// 处理逾期管理
async function handleOverdue(request, env) {
    // verifyAdmin already called in handleAdminLibrary
    const today = new Date().toISOString().slice(0, 10);
    const query = "SELECT bb.*, u.username, b.title as book_title FROM borrowed_books bb JOIN users u ON bb.user_id = u.id JOIN books b ON bb.isbn = b.isbn WHERE bb.due_date < ? AND bb.returned = 0";
    try {
        const { results } = await env.DB.prepare(query).bind(today).all();
        return new Response(
            JSON.stringify({ success: true, results: results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error("逾期管理错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// 处理图书状态管理
async function handleBookStatus(request, env) {
    // verifyAdmin already called in handleAdminLibrary
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    if (!status) {
        return createErrorResponse("Missing required parameter: status", 400);
    }
    const query = "SELECT * FROM books WHERE status = ?";
    try {
        const { results } = await env.DB.prepare(query).bind(status).all();
        return new Response(
            JSON.stringify({ success: true, results: results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error("图书状态管理错误：", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}


// --- 项目2: 用户认证和管理 ---

// 注册 API
async function handleRegister(request, env) {
    try {
        const { email, password, username } = await request.json();
        if (!email || !password || !username) {
            return createErrorResponse('Email, password, and username are required', 400);
        }
        if (!email.includes('@')) {
            return createErrorResponse('Invalid email format', 400);
        }
        const domain = email.split('@')[1];
        const role = ALLOWED_DOMAINS[domain];
        if (!role) {
            return createErrorResponse('Email domain is not allowed', 400);
        }
        const { results: existingUsers } = await env.DB.prepare(
            "SELECT id FROM users WHERE email = ? LIMIT 1"
        ).bind(email).all();
        if (existingUsers && existingUsers.length > 0) {
            return createErrorResponse('Email already registered', 409);
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const { success } = await env.DB.prepare(
            "INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, ?)"
        ).bind(email, username, hashedPassword, role).run();
        if (success) {
            return new Response(JSON.stringify({ success: true, message: 'Registration successful' }), {
                status: 201, headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return createErrorResponse('Registration failed', 500);
        }
    } catch (error) {
        console.error('注册错误：', error);
        return createErrorResponse('Registration failed, please try again later', 500);
    }
}

// 登录 API
async function handleLogin(request, env) {
    try {
        const { email, password } = await request.json();
        if (!email || !password) {
            return createErrorResponse('Email and password are required', 400);
        }
        const { results } = await env.DB.prepare(
            "SELECT id, email, username, password, role FROM users WHERE email = ? LIMIT 1"
        ).bind(email).all();
        if (!results || results.length === 0) {
            return createErrorResponse('User not found or incorrect credentials', 401); // Generic message
        }
        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return createErrorResponse('User not found or incorrect credentials', 401); // Generic message
        }
        const sessionId = nanoid();
        const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        await env.DB.prepare(
            "INSERT INTO sessions (id, user_id, email, username, role, expiry) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(sessionId, user.id, user.email, user.username, user.role, expiry).run();

        const cookie = serialize(COOKIE_NAME, sessionId, {
            httpOnly: true,
            secure: true, // 生产环境应为 true
            sameSite: 'None', // 允许跨站发送 Cookie
            path: '/',
            expires: new Date(expiry),
        });

        return new Response(JSON.stringify({
            success: true,
            message: 'Login successful',
            user: { id: user.id, email: user.email, username: user.username, role: user.role, sessionId: sessionId }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': cookie,
            },
        });
    } catch (error) {
        console.error('登录错误：', error);
        return createErrorResponse('Login failed, please try again later', 500);
    }
}

// 获取当前用户信息 API (GET /api/user)
async function handleGetUser(request, env) {
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }

    try {
        // 从 D1 数据库中检索用户信息
        const { results: userResults } = await env.DB.prepare(
            "SELECT id, email, username, role FROM users WHERE id = ? LIMIT 1"
        ).bind(userVerification.userId).all();

        if (!userResults || userResults.length === 0) {
            return createErrorResponse('User not found', 404); // Should not happen if session is valid
        }
        const user = userResults[0];
        return new Response(JSON.stringify({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error("处理 /api/user GET 请求时发生错误：", error);
        return createErrorResponse('Internal Server Error', 500);
    }
}

// POST /api/user - 示例：验证管理员身份 (实际应是 verifyAdmin, 此处作为路由示例)
async function handlePostUser(request, env) {
    // 这个接口在项目 2 中用于验证管理员，我们已经有了 verifyAdmin 函数
    // 这里我们直接使用 verifyAdmin 的结果
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    // 如果验证通过，返回管理员信息
    return new Response(JSON.stringify({
        success: true,
        message: "Admin verified",
        user: { // 可以从 adminVerification 中获取更多信息如果需要
            userId: adminVerification.userId,
            role: adminVerification.role
        }
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}


// --- 新增：管理员用户管理模块 (Admin User Management) ---

// GET /api/admin/users - 获取用户列表 (管理员)
async function handleAdminGetUsers(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    try {
        const url = new URL(request.url);
        const searchQuery = url.searchParams.get('search');
        const roleFilter = url.searchParams.get('role');
        // 分页参数 (可选实现)
        // const page = parseInt(url.searchParams.get('page') || '1');
        // const limit = parseInt(url.searchParams.get('limit') || '10');
        // const offset = (page - 1) * limit;

        let query = "SELECT id, username, email, role, created_at FROM users WHERE 1=1";
        const params = [];

        if (searchQuery) {
            query += " AND (username LIKE ? OR email LIKE ?)";
            params.push(`%${searchQuery}%`, `%${searchQuery}%`);
        }
        if (roleFilter) {
            query += " AND role = ?";
            params.push(roleFilter);
        }

        query += " ORDER BY created_at DESC";
        // query += " LIMIT ? OFFSET ?"; // 如果实现分页
        // params.push(limit, offset);    // 如果实现分页

        const { results } = await env.DB.prepare(query).bind(...params).all();

        return new Response(JSON.stringify({ success: true, users: results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error("Admin Get Users API Error:", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// GET /api/admin/users/:userId - 获取单个用户信息 (管理员)
async function handleAdminGetUserById(request, env, userId) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    if (!userId) {
        return createErrorResponse("User ID is required in the path.", 400);
    }

    try {
        const { results } = await env.DB.prepare(
            "SELECT id, username, email, role, created_at FROM users WHERE id = ? LIMIT 1"
        ).bind(userId).all();

        if (!results || results.length === 0) {
            return createErrorResponse("User not found.", 404);
        }

        return new Response(JSON.stringify({ success: true, user: results[0] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error("Admin Get User By ID API Error:", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}


// POST /api/admin/users - 创建新用户 (管理员)
async function handleAdminCreateUser(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    try {
        const { email, password, username, role } = await request.json();

        if (!email || !password || !username || !role) {
            return createErrorResponse('Email, password, username, and role are required.', 400);
        }
        if (!['student', 'teacher', 'admin'].includes(role)) {
             return createErrorResponse('Invalid role. Must be student, teacher, or admin.', 400);
        }
        if (!email.includes('@')) {
            return createErrorResponse('Invalid email format.', 400);
        }

        // 检查邮箱是否已存在
        const { results: existingUsers } = await env.DB.prepare(
            "SELECT id FROM users WHERE email = ? LIMIT 1"
        ).bind(email).all();
        if (existingUsers && existingUsers.length > 0) {
            return createErrorResponse('Email already registered.', 409);
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const { meta } = await env.DB.prepare(
            "INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, ?)"
        ).bind(email, username, hashedPassword, role).run();

        if (meta && meta.last_row_id) {
            const newUser = { id: meta.last_row_id, email, username, role };
            return new Response(JSON.stringify({ success: true, message: 'User created successfully.', user: newUser }), {
                status: 201, headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return createErrorResponse('Failed to create user.', 500);
        }
    } catch (error) {
        console.error('Admin Create User API Error:', error);
        // 检查是否是 D1 的唯一约束错误 (例如，如果用户名也需要唯一且数据库有此约束)
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return createErrorResponse('Failed to create user. A unique field (like username or email) might already exist.', 409);
        }
        return createErrorResponse('Internal Server Error: ' + error.message, 500);
    }
}

// PUT /api/admin/users/:userId - 更新用户信息 (管理员)
async function handleAdminUpdateUser(request, env, userId) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    if (!userId) {
        return createErrorResponse("User ID is required in the path.", 400);
    }
    
    try {
        const { username, email, role, newPassword } = await request.json();
        
        // 检查用户是否存在
        const { results: existingUserResults } = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ? LIMIT 1"
        ).bind(userId).all();
        if (!existingUserResults || existingUserResults.length === 0) {
            return createErrorResponse("User not found.", 404);
        }

        const updateFields = [];
        const params = [];

        if (username) {
            updateFields.push("username = ?");
            params.push(username);
        }
        if (email) {
            if (!email.includes('@')) {
                return createErrorResponse('Invalid email format.', 400);
            }
            // 检查新邮箱是否已被其他用户使用
            const { results: emailCheck } = await env.DB.prepare(
                "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1"
            ).bind(email, userId).all();
            if (emailCheck && emailCheck.length > 0) {
                return createErrorResponse('Email already in use by another account.', 409);
            }
            updateFields.push("email = ?");
            params.push(email);
        }
        if (role) {
            if (!['student', 'teacher', 'admin'].includes(role)) {
                return createErrorResponse('Invalid role. Must be student, teacher, or admin.', 400);
            }
            updateFields.push("role = ?");
            params.push(role);
        }
        if (newPassword) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            updateFields.push("password = ?");
            params.push(hashedPassword);
        }

        if (updateFields.length === 0) {
            return createErrorResponse("No fields provided for update.", 400);
        }

        params.push(userId); // For the WHERE clause

        const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
        const { success } = await env.DB.prepare(query).bind(...params).run();

        if (success) {
            // 获取更新后的用户信息（不含密码）
             const { results: updatedUserResults } = await env.DB.prepare(
                "SELECT id, username, email, role, created_at FROM users WHERE id = ? LIMIT 1"
            ).bind(userId).all();

            return new Response(JSON.stringify({ success: true, message: 'User updated successfully.', user: updatedUserResults[0] }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return createErrorResponse('Failed to update user.', 500);
        }
    } catch (error) {
        console.error('Admin Update User API Error:', error);
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return createErrorResponse('Failed to update user. A unique field (like new username or email) might conflict.', 409);
        }
        return createErrorResponse('Internal Server Error: ' + error.message, 500);
    }
}

// DELETE /api/admin/users/:userId - 删除用户 (管理员)
async function handleAdminDeleteUser(request, env, userId) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    if (!userId) {
        return createErrorResponse("User ID is required in the path.", 400);
    }

    try {
        // 检查用户是否存在
        const { results: existingUserResults } = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ? LIMIT 1"
        ).bind(userId).all();
        if (!existingUserResults || existingUserResults.length === 0) {
            return createErrorResponse("User not found.", 404);
        }

        // （可选）检查用户是否有未归还的书籍
        const { results: borrowedBooks } = await env.DB.prepare(
            "SELECT COUNT(*) AS count FROM borrowed_books WHERE user_id = ? AND returned = 0"
        ).bind(userId).first();
        
        if (borrowedBooks && borrowedBooks.count > 0) {
            return createErrorResponse(`Cannot delete user. User has ${borrowedBooks.count} unreturned book(s).`, 409); // Conflict
        }

        // （可选）删除用户的会话记录
        await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
        
        // （可选但推荐）如果用户有其他关联数据，也应在此处处理或给出提示
        // 例如，如果用户是某些图书的作者，或者有其他记录。
        // 实际业务中，物理删除用户前要非常谨慎。

        const { success } = await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

        if (success) {
            return new Response(JSON.stringify({ success: true, message: 'User deleted successfully.' }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            });
        } else {
            // 这通常不应该发生，如果用户存在但删除失败
            return createErrorResponse('Failed to delete user.', 500);
        }
    } catch (error) {
        console.error('Admin Delete User API Error:', error);
        return createErrorResponse('Internal Server Error: ' + error.message, 500);
    }
}


// --- 新增：统计功能 ---

// GET /api/stats/top-borrowers - 列出最近 N 天借书最多的用户 (登录即可)
async function handleGetTopBorrowers(request, env) {
    // 1. 验证普通用户登录状态
    const userVerification = await verifyUser(request, env); // 使用你已有的 verifyUser 函数
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401); // Unauthorized
    }

    try {
        const url = new URL(request.url);
        const daysParam = url.searchParams.get('days');
        const limitParam = url.searchParams.get('limit');

        const days = parseInt(daysParam) || 30; // 默认最近 30 天
        const limit = parseInt(limitParam) || 10; // 默认前 10 名

        if (days <= 0 || limit <= 0) {
            return createErrorResponse("Parameters 'days' and 'limit' must be positive integers.", 400);
        }

        // 计算N天前的日期
        const dateNdaysAgo = new Date();
        dateNdaysAgo.setDate(dateNdaysAgo.getDate() - days);
        const startDate = dateNdaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

        // SQL查询:
        // 统计在指定日期范围内，每个用户的借书次数
        // 并加入用户信息（用户名）
        // 按借书次数降序排列，取前N名
        const query = `
            SELECT
                u.id AS user_id,
                u.username,
                u.email, 
                COUNT(bb.id) AS borrow_count
            FROM borrowed_books bb
            JOIN users u ON bb.user_id = u.id
            WHERE bb.borrow_date >= ?
            GROUP BY u.id, u.username, u.email
            ORDER BY borrow_count DESC
            LIMIT ?
        `;
        // D1 date/time functions might be limited. If direct date comparison fails,
        // you might need to fetch more records and filter in JS, or use a timestamp.
        // For D1, simple string comparison for dates in YYYY-MM-DD format usually works.

        const { results } = await env.DB.prepare(query).bind(startDate, limit).all();

        return new Response(JSON.stringify({ success: true, topBorrowers: results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Get Top Borrowers API Error:", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}

// --- 新增：管理员统计数据 API ---
async function handleAdminGetStats(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    try {
        // 1. 图书总数
        const { results: booksCountResult } = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM books"
        ).first();
        const totalBooks = booksCountResult ? booksCountResult.count : 0;

        // 2. 用户总数
        const { results: usersCountResult } = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM users"
        ).first();
        const totalUsers = usersCountResult ? usersCountResult.count : 0;

        // 3. 当前借出数量
        const { results: currentBorrowsResult } = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM borrowed_books WHERE returned = 0"
        ).first();
        const currentBorrows = currentBorrowsResult ? currentBorrowsResult.count : 0;

        // 4. 逾期数量
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const { results: overdueBorrowsResult } = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM borrowed_books WHERE due_date < ? AND returned = 0"
        ).bind(today).first();
        const overdueBorrows = overdueBorrowsResult ? overdueBorrowsResult.count : 0;
        
        // (可选) 5. 最近 N 天新增用户数
        const daysForNewUsers = 7; // 例如最近 7 天
        const dateNdaysAgoUsers = new Date();
        dateNdaysAgoUsers.setDate(dateNdaysAgoUsers.getDate() - daysForNewUsers);
        const startDateNewUsers = dateNdaysAgoUsers.toISOString().split('T')[0];
        // 假设 users 表有 created_at 字段 (TEXT as ISO8601 string or INTEGER as Unix timestamp)
        // 如果 created_at 是 TEXT "YYYY-MM-DD HH:MM:SS" 或 "YYYY-MM-DD"
        const { results: newUsersCountResult } = await env.DB.prepare(
             "SELECT COUNT(*) as count FROM users WHERE SUBSTR(created_at, 1, 10) >= ?"
        ).bind(startDateNewUsers).first();
        const newUsersLast7Days = newUsersCountResult ? newUsersCountResult.count : 0;


        return new Response(JSON.stringify({
            success: true,
            stats: {
                totalBooks,
                totalUsers,
                currentBorrows,
                overdueBorrows,
                newUsersLast7Days // 可选
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Admin Get Stats API Error:", error);
        return createErrorResponse("Internal Server Error: " + error.message, 500);
    }
}




// --- 主 Fetch Handler ---
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // CORS 预检请求处理 (保持不变)
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Requested-With',
                    'Access-Control-Allow-Credentials': 'true',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        let response;

        // 路由分发
        // (用户认证路由保持不变)
        if (method === 'POST' && path === '/api/register') { response = await handleRegister(request, env); }
        else if (method === 'POST' && path === '/api/login') { response = await handleLogin(request, env); }
        else if (method === 'GET' && path === '/api/user') { response = await handleGetUser(request, env); }
        else if (method === 'POST' && path === '/api/user') { response = await handlePostUser(request, env); } // 你的旧 POST /api/user
        
        // (图书管理路由)
        else if (method === 'POST' && path === '/addbooks') { response = await handleAddBook(request, env); }
        else if (method === 'DELETE' && path === '/deletebooks') { response = await handleDeleteBook(request, env); }
        else if (method === 'GET' && path === '/searchbooks') { response = await handleSearchBook(request, env); }
        else if (method === 'POST' && path === '/borrowbooks') { response = await handleBorrowBook(request, env); }
        else if (method === 'PUT' && path === '/returnbooks') { response = await handleReturnBook(request, env); }
        else if (method === 'GET' && path === '/managebooks') { response = await handleAdminLibrary(request, env); }
        // 新增：修改图书路由
        else if (method === 'PUT' && path.startsWith('/editbook/')) {
            const isbn = path.substring('/editbook/'.length);
            if (isbn) {
                response = await handleEditBook(request, env, isbn);
            } else {
                response = createErrorResponse("ISBN is missing in the path for editing a book.", 400);
            }
        }
        // (管理员用户管理 API 路由保持不变)
        else if (path.startsWith('/api/admin/users')) {
            const userIdMatch = path.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
            if (method === 'GET') {
                if (userIdMatch) { response = await handleAdminGetUserById(request, env, userIdMatch[1]); }
                else if (path === '/api/admin/users') { response = await handleAdminGetUsers(request, env); }
            } else if (method === 'POST' && path === '/api/admin/users') { response = await handleAdminCreateUser(request, env); }
            else if (method === 'PUT' && userIdMatch) { response = await handleAdminUpdateUser(request, env, userIdMatch[1]); }
            else if (method === 'DELETE' && userIdMatch) { response = await handleAdminDeleteUser(request, env, userIdMatch[1]); }
        }
        // 新增：管理员统计 API 路由
        else if (method === 'GET' && path === '/api/admin/stats') {
            response = await handleAdminGetStats(request, env);
        }
        // 新增：统计 API 路由
        else if (method === 'GET' && path === '/api/stats/top-borrowers') {
            response = await handleGetTopBorrowers(request, env);
        }
        // 未匹配
        else {
            response = createErrorResponse("Not Found: The requested endpoint does not exist.", 404);
        }

        // 为所有实际响应添加宽松的 CORS 头部 (保持不变)
        if (response) {
            const finalResponse = new Response(response.body, response);
            finalResponse.headers.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
            finalResponse.headers.set('Access-Control-Allow-Credentials', 'true');
            return finalResponse;
        }
        
        return createErrorResponse("Internal Server Error: No response generated.", 500);
    },
};