// src/handlers/auth.js
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { serialize } from 'cookie'; // 注意：serialize 可能在 Worker 环境中不直接可用或需要特定版本
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin, verifyUser } from '../utils/authHelper.js'; // 引入 verifyAdmin

// 最好将这些常量放在一个共享的 config.js 文件中
const COOKIE_NAME = 'library_session';
const ALLOWED_DOMAINS = {
    'student.pkujx.cn': 'student',
    'pkujx.cn': 'teacher',
    'qq.com': 'student',
    'gmail.com': 'student',
    'outlook.com': 'student'
};

export async function handleRegister(request, env) {
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
        const saltRounds = 10; // bcryptjs 内部会生成盐，这里可以不需要
        const hashedPassword = await bcrypt.hash(password, saltRounds); // saltRounds 是 cost factor
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

export async function handleLogin(request, env) {
    try {
        const { email, password } = await request.json();
        if (!email || !password) {
            return createErrorResponse('Email and password are required', 400);
        }
        const { results } = await env.DB.prepare(
            "SELECT id, email, username, password, role FROM users WHERE email = ? LIMIT 1"
        ).bind(email).all();
        if (!results || results.length === 0) {
            return createErrorResponse('User not found or incorrect credentials', 401);
        }
        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return createErrorResponse('User not found or incorrect credentials', 401);
        }
        const sessionId = nanoid();
        const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        await env.DB.prepare(
            "INSERT INTO sessions (id, user_id, email, username, role, expiry) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(sessionId, user.id, user.email, user.username, user.role, expiry).run();

        // Cloudflare Workers 设置 Cookie 的标准方式是直接构建 Set-Cookie 头部字符串
        // `serialize` 函数主要用于 Node.js 环境，虽然它可能在 Workers 中工作，但不是首选。
        let cookieString = `${COOKIE_NAME}=${sessionId}; Max-Age=${24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=Lax;`;
        // 或 SameSite=None;// 如果希望跨子域，Domain 可以设置为 .bob666.eu.org (假设这是你的主域)
        // 如果是 SameSite=None，则必须 Secure

        return new Response(JSON.stringify({
            success: true,
            message: 'Login successful',
            user: { id: user.id, email: user.email, username: user.username, role: user.role, sessionId: sessionId }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': cookieString, // 直接使用字符串
            },
        });
    } catch (error) {
        console.error('登录错误：', error);
        return createErrorResponse('Login failed, please try again later', 500);
    }
}

export async function handleGetUser(request, env) {
    const userVerification = await verifyUser(request, env); // verifyUser 来自 authHelper
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }
    try {
        const { results: userResults } = await env.DB.prepare(
            "SELECT id, email, username, role FROM users WHERE id = ? LIMIT 1"
        ).bind(userVerification.userId).all();
        if (!userResults || userResults.length === 0) {
            return createErrorResponse('User not found', 404);
        }
        const user = userResults[0];
        return new Response(JSON.stringify({
            success: true,
            user: { id: user.id, email: user.email, username: user.username, role: user.role }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error("处理 /api/user GET 请求时发生错误：", error);
        return createErrorResponse('Internal Server Error', 500);
    }
}

// POST /api/user 实际上是管理员验证，现在由 verifyAdmin 覆盖
// 如果这个 handlePostUser 有特定用途，可以保留，否则可以移除
export async function handlePostUser(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }
    return new Response(JSON.stringify({
        success: true, message: "Admin verified",
        user: { userId: adminVerification.userId, role: adminVerification.role }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}