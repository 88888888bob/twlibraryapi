// src/utils/authHelper.js
import { createErrorResponse } from './responseHelper.js';

const COOKIE_NAME = 'library_session'; // 保持这个常量在此文件或一个共享的 config.js 中

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