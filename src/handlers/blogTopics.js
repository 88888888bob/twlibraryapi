// src/handlers/blogTopics.js
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin } from '../utils/authHelper.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/paginationHelper.js';

// Helper to generate slug (simplified) - this is an internal helper, not exported
function generateSlug(name) {
    if (typeof name !== 'string' || name.trim() === '') {
        // Return a timestamp based slug or throw error if name is essential for slug base
        return `topic-${Date.now().toString(36)}`; 
    }
    return name.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\p{L}\p{N}\-]+/gu, '') // Remove non-alphanumeric (Unicode aware) chars except hyphen
        .replace(/--+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '')             // Trim - from end of text
        .substring(0, 75);              // Max length for slug
}

export async function handleAdminCreateTopic(request, env) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, adminVerification.error.startsWith('Unauthorized') ? 401 : 403);
    }

    try {
        const body = await request.json();
        const name = body.name; // Directly get name
        const description = body.description; // Directly get description

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return createErrorResponse("Topic name is required and must be a non-empty string.", 400);
        }

        const trimmedName = name.trim();
        const slug = generateSlug(trimmedName);
        
        // Check for existing topic by name or slug
        const existingTopic = await env.DB.prepare(
            "SELECT id FROM blog_topics WHERE name = ? OR slug = ?"
        ).bind(trimmedName, slug).first();

        if (existingTopic) {
            return createErrorResponse("A topic with this name or a similar generated slug already exists.", 409);
        }
        
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS
        
        const stmt = env.DB.prepare(
            "INSERT INTO blog_topics (name, slug, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        );
        const { meta } = await stmt.bind(
            trimmedName, 
            slug, 
            description || null, 
            adminVerification.userId, // Assuming verifyAdmin returns userId
            currentTime, 
            currentTime
        ).run();

        if (meta && meta.last_row_id) {
            const newTopic = await env.DB.prepare("SELECT * FROM blog_topics WHERE id = ?")
                .bind(meta.last_row_id)
                .first();
            return new Response(JSON.stringify({ success: true, message: "Topic created successfully.", topic: newTopic }), { 
                status: 201, 
                headers: { 'Content-Type': 'application/json' } 
            });
        } else {
            console.error("Failed to create topic, D1 meta:", meta);
            return createErrorResponse("Failed to create topic: Database error during insertion.", 500);
        }
    } catch (error) {
        console.error("Admin Create Topic Error:", error.message, error.stack);
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return createErrorResponse("Invalid request body: Malformed JSON.", 400);
        }
        if (error.message.includes("UNIQUE constraint failed")) { // More generic unique constraint check
            return createErrorResponse("Topic name or slug already exists (unique constraint).", 409);
        }
        return createErrorResponse("Server error during topic creation: " + error.message, 500);
    }
}

export async function handleGetTopics(request, env) {
    try {
        const { page, limit, offset } = getPaginationParams(request.url, 20); // defaultLimit 20
        const url = new URL(request.url);
        const searchTerm = url.searchParams.get('search');
        
        let queryParams = [];
        let whereConditions = [];

        if (searchTerm) {
            whereConditions.push("t.name LIKE ?");
            queryParams.push(`%${searchTerm}%`);
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
        
        const countQuery = `SELECT COUNT(t.id) as total FROM blog_topics t ${whereClause}`;
        const countResult = await env.DB.prepare(countQuery).bind(...queryParams).first();
        const totalItems = countResult ? countResult.total : 0;

        const dataQuery = `
            SELECT t.id, t.name, t.slug, t.description, 
                   (SELECT COUNT(bpt.post_id) FROM blog_post_topics bpt WHERE bpt.topic_id = t.id) as post_count 
            FROM blog_topics t 
            ${whereClause} 
            ORDER BY t.name ASC LIMIT ? OFFSET ?`;
        
        const dataQueryParams = [...queryParams, limit, offset];
        const { results: topics } = await env.DB.prepare(dataQuery).bind(...dataQueryParams).all();

        return new Response(JSON.stringify(formatPaginatedResponse(topics || [], totalItems, page, limit)), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error("Get Topics Error:", error.message, error.stack);
        return createErrorResponse("Server error while fetching topics: " + error.message, 500);
    }
}

// Future Topic Handlers (Update, Delete, Get Single) can be added here
// export async function handleAdminUpdateTopic(request, env, topicId) { ... }
// export async function handleAdminDeleteTopic(request, env, topicId) { ... }
// export async function handleGetTopicByIdOrSlug(request, env, idOrSlug) { ... }