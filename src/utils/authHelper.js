// src/utils/authHelper.js
import { createErrorResponse } from './responseHelper.js';

const COOKIE_NAME = 'library_session';

async function getUsernameForUser(env, userId) {
    if (!userId) return 'UnknownUser'; // Fallback if userId is somehow missing
    try {
        const userData = await env.DB.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first();
        return userData ? userData.username : 'UnknownUser'; // Fallback if user not found by ID
    } catch (e) {
        console.error(`Error fetching username for userId ${userId}:`, e);
        return 'ErrorFetchingUser'; // Indicate an error occurred
    }
}

export async function verifyAdmin(request, env) {
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
        // 从 sessions 表获取 username
        const sessionData = await env.DB.prepare(
            "SELECT user_id, role, username FROM sessions WHERE id = ? AND expiry > ?"
        ).bind(sessionId, Date.now()).first(); // Using .first()

        if (!sessionData) {
            return { authorized: false, error: 'Unauthorized: Invalid or expired session' };
        }
        
        if (sessionData.role !== 'admin') {
            return { authorized: false, error: 'Forbidden: Insufficient privileges' };
        }

        // 如果 sessions 表没有 username，则从 users 表补全 (理论上登录时应已写入)
        let usernameToReturn = sessionData.username;
        if (!usernameToReturn && sessionData.user_id) {
             console.warn(`[verifyAdmin] Username not found in session for user_id: ${sessionData.user_id}, fetching from users table.`);
             usernameToReturn = await getUsernameForUser(env, sessionData.user_id);
        }


        return { 
            authorized: true, 
            userId: sessionData.user_id, 
            role: sessionData.role,
            username: usernameToReturn || 'AdminUser' // Fallback if still not found
        };
    } catch (error) {
        console.error("验证管理员身份失败：", error);
        return { authorized: false, error: 'Internal Server Error: Failed to verify admin status' };
    }
}

export async function verifyUser(request, env) {
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
        // 从 sessions 表获取 username
        const sessionData = await env.DB.prepare(
            "SELECT user_id, role, username FROM sessions WHERE id = ? AND expiry > ?"
        ).bind(sessionId, Date.now()).first(); // Using .first()

        if (!sessionData) {
            return { authorized: false, error: 'Unauthorized: Invalid or expired session' };
        }

        // 如果 sessions 表没有 username，则从 users 表补全 (理论上登录时应已写入)
        let usernameToReturn = sessionData.username;
        if (!usernameToReturn && sessionData.user_id) {
             console.warn(`[verifyUser] Username not found in session for user_id: ${sessionData.user_id}, fetching from users table.`);
             usernameToReturn = await getUsernameForUser(env, sessionData.user_id);
        }

        return { 
            authorized: true, 
            userId: sessionData.user_id, 
            role: sessionData.role,
            username: usernameToReturn || 'DefaultUser' // Fallback if still not found
        };
    } catch (error) {
        console.error("验证用户身份失败：", error);
        return { authorized: false, error: 'Internal Server Error: Failed to verify user status' };
    }
}