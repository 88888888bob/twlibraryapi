// src/handlers/settings.js
import sanitizeHtml from 'sanitize-html';
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin } from '../utils/authHelper.js';

export async function handleGetSiteSetting(request, env, settingKey) {
    console.log(`[HANDLER handleGetSiteSetting] START - Key: "${settingKey}"`);
    
    if (!settingKey || settingKey.trim() === "") { // 更严格的检查
        console.warn(`[HANDLER handleGetSiteSetting] EMPTY or INVALID key received: "${settingKey}"`);
        return createErrorResponse("Setting key is required and cannot be empty.", 400);
    }
    try {
        const stmt = env.DB.prepare("SELECT setting_value, last_updated FROM site_settings WHERE setting_key = ?");
        const { results } = await stmt.bind(settingKey).first();
        
        console.log(`[HANDLER handleGetSiteSetting] DB query for key "${settingKey}" returned: ${JSON.stringify(results)}`);

        if (!results) {
            console.log(`[HANDLER handleGetSiteSetting] Setting key "${settingKey}" NOT FOUND in DB.`);
            return createErrorResponse(`Setting '${settingKey}' not found in database.`, 404);
        }
        
        console.log(`[HANDLER handleGetSiteSetting] Setting key "${settingKey}" FOUND. Returning value.`);
        return new Response(JSON.stringify({
            success: true, key: settingKey, value: results.setting_value, last_updated: results.last_updated
        }), { status: 200, headers: { 'Content-Type': 'application/json' }});
    } catch (error) {
        console.error(`[HANDLER handleGetSiteSetting] ERROR for key "${settingKey}":`, error);
        return createErrorResponse("Server Error while fetching setting: " + error.message, 500);
    }
}
export async function handleAdminGetAllSiteSettings(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    try {
        const { results } = await env.DB.prepare("SELECT setting_key, setting_value, description, last_updated FROM site_settings ORDER BY setting_key ASC").all();
        return new Response(JSON.stringify({ success: true, settings: results || [] }), { status: 200 });
    } catch (error) {
        console.error("Admin Get All Settings Error:", error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}

export async function handleAdminUpdateSiteSetting(request, env, settingKey) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) return createErrorResponse(adminVerification.error, 401);
    if (!settingKey) return createErrorResponse("Setting key required.", 400);

    try {
        const requestBody = await request.json();
        let value = requestBody.value;
        const description = requestBody.description;
        if (value === undefined) return createErrorResponse("'value' required.", 400);

        const htmlSettingKeys = ['announcement_bar_html', 'news_content_html', 'comment_html'];
        if (htmlSettingKeys.includes(settingKey) && typeof value === 'string') {
            let sanitizeOptions = { // Default stricter options for safety
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(['u', 's', 'span', 'img', 'pre', 'code']),
                allowedAttributes: {
                    ...sanitizeHtml.defaults.allowedAttributes,
                    'a': ['href', 'name', 'target', 'rel'],
                    'img': ['src', 'alt', 'title', 'width', 'height', 'style'],
                    'span': ['style', 'class'],
                    'p': ['style', 'class'],
                    '*': ['class'] // Allow class on any tag
                },
                 allowedStyles: {
                    '*': {
                        'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\([0-9\s,]+\)$/i, /^rgba\([0-9\s,.]+\)$/i],
                        'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\([0-9\s,]+\)$/i, /^rgba\([0-9\s,.]+\)$/i],
                        'font-size': [/^\d+(?:px|em|rem|pt|%)$/],
                        'font-family': [/^[\w\s,-]+$/i],
                        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
                        'font-weight': true, 'font-style': true, 'text-decoration': true,
                    }
                },
                transformTags: { 'b': 'strong', 'i': 'em' },
                allowComments: false,
                allowedSchemes: ['http', 'https', 'mailto', 'tel'],
            };
            if (settingKey === 'announcement_bar_html') { // More restrictive for announcement
                sanitizeOptions.allowedTags = ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'span'];
                sanitizeOptions.allowedAttributes = { 'a': ['href', 'target', 'rel'], 'span': ['style'] };
                sanitizeOptions.allowedStyles = { 'span': {
                    'color': sanitizeOptions.allowedStyles['*']['color'],
                    'background-color': sanitizeOptions.allowedStyles['*']['background-color'],
                     'font-weight': true, 'font-style': true, 'text-decoration': true,
                }};
            }
            value = sanitizeHtml(value, sanitizeOptions);
        } else if (typeof value === 'string' && value.trim() === '') {
            value = '';
        } else if (value !== null && typeof value !== 'string' && htmlSettingKeys.includes(settingKey)) {
            console.warn(`Value for HTML setting '${settingKey}' not a string:`, value);
            value = '';
        }

        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const stmt = env.DB.prepare(
            `INSERT INTO site_settings (setting_key, setting_value, description, last_updated) VALUES (?, ?, ?, ?)
             ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, description=excluded.description, last_updated=excluded.last_updated`
        );
        const { success, meta } = await stmt.bind(settingKey, value, description ?? null, currentTime).run();

        if (success) {
            const { results: updated } = await env.DB.prepare("SELECT * FROM site_settings WHERE setting_key = ?").bind(settingKey).first();
            return new Response(JSON.stringify({ success: true, message: 'Setting updated.', setting: updated }), { status: 200 });
        } else {
            console.error(`D1 UPSERT failed for '${settingKey}':`, meta);
            return createErrorResponse('Failed to update setting (DB error).', 500);
        }
    } catch (error) {
        if (error instanceof SyntaxError) return createErrorResponse("Invalid JSON body.", 400);
        console.error(`Update Site Setting (key: ${settingKey}) Error:`, error);
        return createErrorResponse("Server Error: " + error.message, 500);
    }
}