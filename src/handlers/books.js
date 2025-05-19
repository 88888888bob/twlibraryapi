// src/handlers/books.js
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin, verifyUser } from '../utils/authHelper.js';
import { verifyUser } from '../utils/authHelper.js'; // 确保引入 verifyUser
import { getPaginationParams, formatPaginatedResponse } from '../utils/paginationHelper.js';

// --- 内部图书数据库操作辅助函数 ---
async function getBookByISBNInternal(env, isbn) {
    const { results } = await env.DB.prepare("SELECT * FROM books WHERE isbn = ? LIMIT 1").bind(isbn).all();
    return results && results.length > 0 ? results[0] : null;
}

async function addBookInternal(env, bookData) {
    const { isbn, title, author, publisher, publication_date, category_id, total_copies, status } = bookData;
    try {
        // available_copies 应该等于 total_copies 在添加新书时
        await env.DB.prepare(
            "INSERT INTO books (isbn, title, author, publisher, publication_date, category_id, total_copies, available_copies, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(isbn, title, author, publisher, publication_date, category_id, total_copies, total_copies, status).run();
        return true;
    } catch (error) {
        console.error("DB: 添加图书失败：", error);
        throw error; // 重新抛出以便上层 handler 处理
    }
}

async function deleteBookInternal(env, isbn) {
    try {
        const { success, meta } = await env.DB.prepare("DELETE FROM books WHERE isbn = ?").bind(isbn).run();
        return success && meta.changes > 0;
    } catch (error) {
        console.error("DB: 删除图书失败：", error);
        throw error;
    }
}

async function borrowBookInternal(env, isbn, user_id, due_date) {
    const tx = env.DB.batch([
        env.DB.prepare("INSERT INTO borrowed_books (isbn, user_id, borrow_date, due_date, returned) VALUES (?, ?, date('now'), ?, 0)"),
        env.DB.prepare("UPDATE books SET available_copies = available_copies - 1, status = CASE WHEN available_copies - 1 = 0 THEN '借出' ELSE status END WHERE isbn = ?")
    ]);
    try {
        await tx[0].bind(isbn, user_id, due_date).run();
        await tx[1].bind(isbn).run();
        // D1 batch 不像 transaction 那样原子性保证，但可以减少往返。
        // 更安全的做法是先检查 available_copies > 0
        return true;
    } catch (error) {
        console.error("DB: 借阅图书失败：", error);
        throw error;
    }
}

async function returnBookInternal(env, isbn, user_id) {
    const tx = env.DB.batch([
        env.DB.prepare("UPDATE borrowed_books SET returned = 1, return_date = date('now') WHERE isbn = ? AND user_id = ? AND returned = 0"),
        env.DB.prepare("UPDATE books SET available_copies = available_copies + 1, status = '在馆' WHERE isbn = ?") // 假设归还后状态为在馆
    ]);
    try {
        const updateResult = await tx[0].bind(isbn, user_id).run();
        if (updateResult.meta.changes === 0) return false; // 没有记录被更新
        await tx[1].bind(isbn).run();
        return true;
    } catch (error) {
        console.error("DB: 归还图书失败：", error);
        throw error;
    }
}


// --- API Handlers ---
export async function handleEditBook(request, env, isbn) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }
    if (!isbn) return createErrorResponse("ISBN is required.", 400);

    try {
        const existingBook = await getBookByISBNInternal(env, isbn);
        if (!existingBook) return createErrorResponse("Book not found.", 404);

        const requestBody = await request.json();
        const { title, author, publisher, publication_date, category_id, total_copies, available_copies, status } = requestBody;

        const updateFields = [];
        const params = [];

        if (title !== undefined) { updateFields.push("title = ?"); params.push(title); }
        if (author !== undefined) { updateFields.push("author = ?"); params.push(author === '' ? null : author); }
        if (publisher !== undefined) { updateFields.push("publisher = ?"); params.push(publisher === '' ? null : publisher); }
        if (publication_date !== undefined) { updateFields.push("publication_date = ?"); params.push(publication_date || null); }
        if (category_id !== undefined) { updateFields.push("category_id = ?"); params.push(category_id ? parseInt(category_id) : null); }
        if (total_copies !== undefined) {
            const tc = parseInt(total_copies);
            if (isNaN(tc) || tc < 0) return createErrorResponse("Invalid total_copies.", 400);
            updateFields.push("total_copies = ?"); params.push(tc);
        }
        if (available_copies !== undefined) {
            const ac = parseInt(available_copies);
            if (isNaN(ac) || ac < 0) return createErrorResponse("Invalid available_copies.", 400);
            const tcToCompare = total_copies !== undefined ? parseInt(total_copies) : existingBook.total_copies;
            if (ac > tcToCompare) return createErrorResponse("Available copies cannot exceed total copies.", 400);
            updateFields.push("available_copies = ?"); params.push(ac);
        }
        if (status !== undefined) { updateFields.push("status = ?"); params.push(status); }

        if (updateFields.length === 0) return createErrorResponse("No fields to update.", 400);
        
        updateFields.push("updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')"); // 更新时间
        params.push(isbn);

        const query = `UPDATE books SET ${updateFields.join(", ")} WHERE isbn = ?`;
        const { success, meta } = await env.DB.prepare(query).bind(...params).run();

        if (success && meta.changes > 0) {
            const updatedBook = await getBookByISBNInternal(env, isbn);
            return new Response(JSON.stringify({ success: true, message: 'Book updated.', book: updatedBook }), { status: 200 });
        } else if (meta.changes === 0) {
            return createErrorResponse('No changes made.', 304);
        } else {
            return createErrorResponse('Failed to update book.', 500);
        }
    } catch (error) {
        console.error("Edit Book API Error:", error);
        if (error.message?.includes('UNIQUE constraint failed')) return createErrorResponse('Update failed (unique constraint).', 409);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleAddBook(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    try {
        const requestBody = await request.json();
        const { isbn, title, category_id } = requestBody; // 仅检查最核心的
        if (!isbn || !title || !category_id) return createErrorResponse("ISBN, title, category_id required.", 400);
        
        if (await getBookByISBNInternal(env, isbn)) return createErrorResponse("ISBN already exists.", 409);
        
        await addBookInternal(env, { // 传递完整数据，让内部函数处理默认值
            isbn, title, category_id,
            author: requestBody.author || null,
            publisher: requestBody.publisher || null,
            publication_date: requestBody.publication_date || null,
            total_copies: parseInt(requestBody.total_copies) || 1,
            status: requestBody.status || '在馆',
        });
        const newBook = await getBookByISBNInternal(env, isbn); // 获取刚添加的书籍信息
        return new Response(JSON.stringify({ success: true, message: "Book added.", book: newBook }), { status: 201 });
    } catch (error) {
        console.error("Add Book API Error:", error);
        if (error.message?.includes('UNIQUE constraint failed')) return createErrorResponse('Failed to add book (unique constraint).', 409);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleDeleteBook(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    try {
        const { isbn } = await request.json();
        if (!isbn) return createErrorResponse("ISBN required.", 400);
        if (!await getBookByISBNInternal(env, isbn)) return createErrorResponse("Book not found.", 404);

        const { results } = await env.DB.prepare("SELECT COUNT(*) AS count FROM borrowed_books WHERE isbn = ? AND returned = 0").bind(isbn).first();
        if (results?.count > 0) return createErrorResponse("Book is currently borrowed.", 409);

        if (await deleteBookInternal(env, isbn)) {
            return new Response(JSON.stringify({ success: true, message: "Book deleted." }), { status: 200 });
        } else {
            return createErrorResponse("Failed to delete book (no rows affected).", 404); // Or 500 if unexpected
        }
    } catch (error) {
        console.error("Delete Book API Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleSearchBook(request, env) {
    const userVerification = await verifyUser(request, env); // 登录即可搜索
    if (!userVerification.authorized) return createErrorResponse(userVerification.error, 401);
    try {
        const url = new URL(request.url);
        const params = [];
        let query = "SELECT b.*, c.name as category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE 1=1";

        if (url.searchParams.get('isbn')) { query += " AND b.isbn = ?"; params.push(url.searchParams.get('isbn')); }
        if (url.searchParams.get('title')) { query += " AND b.title LIKE ?"; params.push(`%${url.searchParams.get('title')}%`); }
        if (url.searchParams.get('author')) { query += " AND b.author LIKE ?"; params.push(`%${url.searchParams.get('author')}%`); }
        if (url.searchParams.get('category_id')) { query += " AND b.category_id = ?"; params.push(parseInt(url.searchParams.get('category_id'))); }
        if (url.searchParams.get('status')) { query += " AND b.status = ?"; params.push(url.searchParams.get('status')); }
        // 可以添加排序和分页
        query += " ORDER BY b.title ASC";

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify({ success: true, results: results || [] }), { status: 200 });
    } catch (error) {
        console.error("Search Book API Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleBorrowBook(request, env) {
    const adminVerification = await verifyAdmin(request, env); // 假设只有管理员操作
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    try {
        const { isbn, user_id, due_date } = await request.json();
        if (!isbn || !user_id || !due_date) return createErrorResponse("ISBN, user_id, due_date required.", 400);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) return createErrorResponse("Invalid due_date format (YYYY-MM-DD).", 400);

        const book = await getBookByISBNInternal(env, isbn);
        if (!book) return createErrorResponse("Book not found.", 404);
        if (book.available_copies <= 0) return createErrorResponse("Book not available.", 409);
        
        const { results: user } = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(user_id).first();
        if (!user) return createErrorResponse("User not found.", 404);

        await borrowBookInternal(env, isbn, user_id, due_date);
        return new Response(JSON.stringify({ success: true, message: "Book borrowed." }), { status: 200 });
    } catch (error) {
        console.error("Borrow Book API Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleReturnBook(request, env) {
    const adminVerification = await verifyAdmin(request, env); // 假设只有管理员操作
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    try {
        const { isbn, user_id } = await request.json();
        if (!isbn || !user_id) return createErrorResponse("ISBN, user_id required.", 400);

        if (!await getBookByISBNInternal(env, isbn)) return createErrorResponse("Book not found.", 404);
        const { results: user } = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(user_id).first();
        if (!user) return createErrorResponse("User not found.", 404);

        const { results: borrowRecord } = await env.DB.prepare("SELECT id FROM borrowed_books WHERE isbn = ? AND user_id = ? AND returned = 0").bind(isbn, user_id).first();
        if (!borrowRecord) return createErrorResponse("No active borrow record found.", 404);

        if (await returnBookInternal(env, isbn, user_id)) {
            return new Response(JSON.stringify({ success: true, message: "Book returned." }), { status: 200 });
        } else {
             return createErrorResponse("Failed to return book (no record updated).", 404); // Or 500
        }
    } catch (error) {
        console.error("Return Book API Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleBlogSearchBooks(request, env) {
    // User needs to be logged in to use this while writing a post
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }

    try {
        const url = new URL(request.url);
        const searchQuery = url.searchParams.get('query');
        const limit = parseInt(url.searchParams.get('limit')) || 10; // Default limit

        if (!searchQuery || searchQuery.trim() === '') {
            return createErrorResponse("Search query is required.", 400);
        }
        if (limit <=0 || limit > 50) { // Max limit to prevent abuse
            return createErrorResponse("Limit must be between 1 and 50.", 400);
        }

        const searchTerm = `%${searchQuery.trim()}%`;
        
        // Search by title or ISBN
        // We only need isbn and title for this endpoint
        const { results } = await env.DB.prepare(
            "SELECT isbn, title FROM books WHERE title LIKE ? OR isbn LIKE ? ORDER BY title ASC LIMIT ?"
        ).bind(searchTerm, searchTerm, limit).all();

        return new Response(JSON.stringify({ success: true, books: results || [] }), { status: 200 });

    } catch (error) {
        console.error("Blog Search Books Error:", error);
        return createErrorResponse("Server error while searching books: " + error.message, 500);
    }
}