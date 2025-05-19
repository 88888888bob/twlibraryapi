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
    if (!userId) return createErrorResponse("User ID required.", 400);
    try {
        const { results } = await env.DB.prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?")
            .bind(userId).first(); // .first() is better if expecting one or none
        if (!results) return createErrorResponse("User not found.", 404);
        return new Response(JSON.stringify({ success: true, user: results }), { status: 200 });
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
    if (!userId) return createErrorResponse("User ID required.", 400);
    try {
        const { results: userExists } = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
        if (!userExists) return createErrorResponse("User not found.", 404);

        const { username, email, role, newPassword } = await request.json();
        const updateFields = [];
        const params = [];

        if (username) { updateFields.push("username = ?"); params.push(username); }
        if (email) {
            if (!email.includes('@')) return createErrorResponse('Invalid email format.', 400);
            const { results: emailCheck } = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(email, userId).first();
            if (emailCheck) return createErrorResponse('Email already in use.', 409);
            updateFields.push("email = ?"); params.push(email);
        }
        if (role) {
            if (!['student', 'teacher', 'admin'].includes(role)) return createErrorResponse("Invalid role.", 400);
            updateFields.push("role = ?"); params.push(role);
        }
        if (newPassword) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updateFields.push("password = ?"); params.push(hashedPassword);
        }

        if (updateFields.length === 0) return createErrorResponse("No fields to update.", 400);
        params.push(userId);

        const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
        const { success, meta } = await env.DB.prepare(query).bind(...params).run();

        if (success && meta.changes > 0) {
            const { results: updatedUser } = await env.DB.prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?").bind(userId).first();
            return new Response(JSON.stringify({ success: true, message: 'User updated.', user: updatedUser }), { status: 200 });
        } else if (meta.changes === 0) {
            return createErrorResponse('No changes made to user.', 304);
        } else {
            return createErrorResponse('Failed to update user.', 500);
        }
    } catch (error) {
        console.error('Admin Update User Error:', error);
        if (error.message?.includes('UNIQUE constraint failed')) return createErrorResponse('Update failed (unique constraint).', 409);
        return createErrorResponse('Server Error: ' + error.message, 500);
    }
}

export async function handleAdminDeleteUser(request, env, userId) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    if (!userId) return createErrorResponse("User ID required.", 400);
    try {
        const { results: userExists } = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
        if (!userExists) return createErrorResponse("User not found.", 404);

        const { results: borrowedBooks } = await env.DB.prepare("SELECT COUNT(*) AS count FROM borrowed_books WHERE user_id = ? AND returned = 0").bind(userId).first();
        if (borrowedBooks?.count > 0) return createErrorResponse(`User has ${borrowedBooks.count} unreturned books.`, 409);
        
        // Consider cascading deletes or soft deletes based on your DB schema and business rules
        await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run(); // Delete sessions first
        const { success, meta } = await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

        if (success && meta.changes > 0) {
            return new Response(JSON.stringify({ success: true, message: 'User deleted.' }), { status: 200 });
        } else {
            return createErrorResponse('Failed to delete user (no rows affected).', 404);
        }
    } catch (error) {
        console.error('Admin Delete User Error:', error);
        return createErrorResponse('Server Error: ' + error.message, 500);
    }
}