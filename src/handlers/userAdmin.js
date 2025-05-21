// src/handlers/userAdmin.js
import * as bcrypt from 'bcryptjs';
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin } from '../utils/authHelper.js';

export async function handleAdminGetUsers(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    try {
        const url = new URL(request.url);
        const params = [];
        let query = "SELECT id, username, email, role, created_at FROM users WHERE 1=1";

        if (url.searchParams.get('search')) {
            query += " AND (username LIKE ? OR email LIKE ?)";
            params.push(`%${url.searchParams.get('search')}%`, `%${url.searchParams.get('search')}%`);
        }
        if (url.searchParams.get('role')) {
            query += " AND role = ?";
            params.push(url.searchParams.get('role'));
        }
        query += " ORDER BY created_at DESC";
        // Add pagination if needed

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify({ success: true, users: results || [] }), { status: 200 });
    } catch (error) {
        console.error("Admin Get Users Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleAdminGetUserById(request, env, userId) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    // 确保 userId 是正确的类型，D1 通常期望绑定的值与列类型匹配
    // 如果 id 列是 INTEGER，而 userId 是字符串 "3"，D1 通常能处理，但显式转换更安全
    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
        return createErrorResponse("Invalid User ID format. Must be a number.", 400);
    }

    try {
        console.log(`[handleAdminGetUserById] Fetching user with ID: ${numericUserId}`); // 添加日志

        const user = await env.DB.prepare(
            "SELECT id, username, email, role, created_at FROM users WHERE id = ?"
        ).bind(numericUserId).first(); // 使用 .first() 并绑定转换后的 numericUserId

        console.log(`[handleAdminGetUserById] DB result for ID ${numericUserId}:`, JSON.stringify(user)); // 添加日志

        if (!user) { // .first() 在找不到时返回 null
            console.log(`[handleAdminGetUserById] User with ID ${numericUserId} not found in DB.`); // 添加日志
            return createErrorResponse("User not found.", 404);
        }
        
        // 用户已找到，user 是包含用户数据的对象
        return new Response(JSON.stringify({ success: true, user: user }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error("Admin Get User By ID Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleAdminCreateUser(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    try {
        const { email, password, username, role } = await request.json();
        if (!email || !password || !username || !role) return createErrorResponse("All fields required.", 400);
        if (!['student', 'teacher', 'admin'].includes(role)) return createErrorResponse("Invalid role.", 400);
        if (!email.includes('@')) return createErrorResponse('Invalid email format.', 400);

        const { results: existingUser } = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
        if (existingUser) return createErrorResponse("Email already exists.", 409);
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const { meta } = await env.DB.prepare("INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, ?)")
            .bind(email, username, hashedPassword, role).run();

        if (meta?.last_row_id) {
            const newUser = { id: meta.last_row_id, email, username, role };
            return new Response(JSON.stringify({ success: true, message: 'User created.', user: newUser }), { status: 201 });
        } else {
            return createErrorResponse('Failed to create user.', 500);
        }
    } catch (error) {
        console.error('Admin Create User Error:', error);
        if (error.message?.includes('UNIQUE constraint failed')) return createErrorResponse('Create failed (unique constraint).', 409);
        return createErrorResponse('Server Error: ' + error.message, 500);
    }
}

export async function handleAdminUpdateUser(request, env, userId) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    if (!userId) {
        return createErrorResponse("User ID (from path) is required.", 400);
    }
    
    // 声明并初始化 numericUserId
    const numericUserId = parseInt(userId); 
    if (isNaN(numericUserId)) {
        return createErrorResponse("Invalid User ID format in path. Must be a number.", 400);
    }

    try {
        console.log(`[handleAdminUpdateUser] Attempting to update user with ID (parsed): ${numericUserId}`);

        const userExists = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ?"
        ).bind(numericUserId).first(); // 使用 numericUserId

        console.log(`[handleAdminUpdateUser] Check if user ${numericUserId} exists:`, JSON.stringify(userExists));

        if (!userExists) {
            console.warn(`[handleAdminUpdateUser] User ${numericUserId} not found during initial check.`);
            return createErrorResponse("User not found.", 404);
        }

        // ... (获取 request.json(), 构建 updateFields 和 params)
        // 在所有使用用户 ID 进行数据库操作的地方，都使用 numericUserId
        // 例如：
        // if (email) {
        //    const emailCheck = await env.DB.prepare(...).bind(email, numericUserId).first();
        //    ...
        // }
        // params.push(numericUserId); // For the WHERE clause
        // ...

        const { username, email, role, newPassword } = await request.json();
        const updateFields = [];
        const paramsToBind = []; // 使用一个新的数组来收集绑定参数

        if (username !== undefined) { updateFields.push("username = ?"); paramsToBind.push(username); }
        if (email !== undefined) {
            if (!email.includes('@')) return createErrorResponse('Invalid email format.', 400);
            const emailCheck = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(email, numericUserId).first();
            if (emailCheck) return createErrorResponse('Email already in use by another account.', 409);
            updateFields.push("email = ?"); paramsToBind.push(email);
        }
        if (role !== undefined) {
            if (!['student', 'teacher', 'admin'].includes(role)) return createErrorResponse("Invalid role specified.", 400);
            updateFields.push("role = ?"); paramsToBind.push(role);
        }
        if (newPassword !== undefined && newPassword.trim() !== '') {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updateFields.push("password = ?"); paramsToBind.push(hashedPassword);
        }

        if (updateFields.length === 0) {
            return createErrorResponse("No fields provided to update.", 400);
        }
        
        // 添加 updated_at (如果你的表有这个字段且希望自动更新)
        // updateFields.push("updated_at = STRFTIME('%Y-%m-%d %H:%M:%S', 'now', 'localtime')");
        // 不需要为 updated_at 添加到 paramsToBind，因为它在 SQL 中直接计算

        paramsToBind.push(numericUserId); // 最后添加 WHERE id = ? 的参数

        const updateQuery = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
        console.log(`[handleAdminUpdateUser] Update query for user ${numericUserId}: ${updateQuery}`);
        console.log(`[handleAdminUpdateUser] Update params for user ${numericUserId}:`, JSON.stringify(paramsToBind));

        const { success, meta } = await env.DB.prepare(updateQuery).bind(...paramsToBind).run();
        console.log(`[handleAdminUpdateUser] Update result for user ${numericUserId}: success=${success}, meta=`, JSON.stringify(meta));

        if (success && meta.changes > 0) {
            const updatedUser = await env.DB.prepare(
                "SELECT id, username, email, role, created_at FROM users WHERE id = ?"
            ).bind(numericUserId).first();
            
            console.log(`[handleAdminUpdateUser] Refetched user ${numericUserId} after update:`, JSON.stringify(updatedUser));
            if (!updatedUser) {
                 console.error(`[handleAdminUpdateUser] CRITICAL: User ${numericUserId} updated but could not be refetched!`);
                 return createErrorResponse('User data updated, but failed to retrieve the updated record.', 500);
            }
            return new Response(JSON.stringify({ success: true, message: 'User updated successfully.', user: updatedUser }), { status: 200 });
        } else if (meta.changes === 0) {
            // This could mean the data sent was identical to existing data, or user not found (though checked earlier)
            console.warn(`[handleAdminUpdateUser] No rows affected for user ${numericUserId}. Data might be identical or issue with query.`);
            // To be more precise, you could re-fetch and compare to see if it was due to identical data.
            // For now, assume it means no effective change.
            const currentUserState = await env.DB.prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?").bind(numericUserId).first();
            return new Response(JSON.stringify({ success: true, message: 'No changes applied to user.', user: currentUserState }), { status: 200 });

        } else { // success is false or meta.changes is negative (error)
            console.error(`[handleAdminUpdateUser] D1 UPDATE failed for user ${numericUserId} despite success=${success}, meta=`, JSON.stringify(meta));
            return createErrorResponse('Failed to update user due to a database error.', 500);
        }

    } catch (error) {
        console.error(`Admin Update User Error (ID: ${userId}):`, error.message, error.stack); // Log original userId for context
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return createErrorResponse("Invalid request body: Malformed JSON.", 400);
        }
        if (error.message && error.message.includes("UNIQUE constraint failed")) {
            return createErrorResponse('Update failed: A unique field (like email or username if unique) already exists for another user.', 409);
        }
        // Send back the actual error message if it's a ReferenceError for numericUserId
        return createErrorResponse(`Server Error: ${error.message}`, 500);
    }
}