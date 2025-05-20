// src/handlers/blogTopics.js
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyAdmin } from '../utils/authHelper.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/paginationHelper.js';

// Helper to generate slug (simplified)
function generateSlug(name) {
    return name.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w-]+/g, '')       // Remove all non-word chars
        .replace(/--+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

export async function handleGetTopics(request, env) {
    // No auth needed for public listing for now, can add verifyUser if needed
    try {
        const { page, limit, offset } = getPaginationParams(request.url, 20); // Default 20 topics per page
        const url = new URL(request.url);
        const searchTerm = url.searchParams.get('search');
        let queryParams = [];

        let countQuery = "SELECT COUNT(*) as total FROM blog_topics";
        let dataQuery = "SELECT id, name, slug, description, (SELECT COUNT(*) FROM blog_post_topics WHERE topic_id = blog_topics.id) as post_count FROM blog_topics";
        
        if (searchTerm) {
            const searchCondition = " WHERE name LIKE ?";
            countQuery += searchCondition;
            dataQuery += searchCondition;
            queryParams.push(`%${searchTerm}%`);
        }
        
        dataQuery += " ORDER BY name ASC LIMIT ? OFFSET ?";
        queryParams.push(limit, offset);

        const countResult = await env.DB.prepare(countQuery).bind(...(searchTerm ? [queryParams[0]] : [])).first();
        const totalItems = countResult ? countResult.total : 0;
        
        const { results: topics } = await env.DB.prepare(dataQuery).bind(...queryParams).all();

        return new Response(JSON.stringify(formatPaginatedResponse(topics || [], totalItems, page, limit)), { status: 200 });

    } catch (error) {
        console.error("Get Topics Error:", error);
        return createErrorResponse("Server error: " + error.message, 500);
    }
}