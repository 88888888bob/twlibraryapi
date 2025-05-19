// src/utils/responseHelper.js
export function createErrorResponse(message, status) {
    return new Response(JSON.stringify({ success: false, message: message }), {
        status: status,
        headers: { 'Content-Type': 'application/json' },
    });
}