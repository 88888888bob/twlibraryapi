// src/handlers/blogPosts.js
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyUser, verifyAdmin } from '../utils/authHelper.js';
import { sanitizeBlogContent } from '../utils/sanitizeHelper.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/paginationHelper.js';

// Helper to generate slug (simplified) - can be moved to a common util if used elsewhere
function generatePostSlug(title) {
    const S = require('slugify'); // Hypothetical slugify library, or implement simply
    return S(title, { lower: true, strict: true, locale: 'en' }) + '-' + Date.now().toString(36).slice(-6);
    // A more robust slug generation would check for uniqueness and append numbers if needed
    // Simplified for now:
    // return title.toString().toLowerCase()
    //     .replace(/\s+/g, '-')
    //     .replace(/[^\w-]+/g, '')
    //     .replace(/--+/g, '-')
    //     .replace(/^-+/, '')
    //     .replace(/-+$/, '')
    //     .substring(0, 75); // Max length for slug
}


export async function handleCreateBlogPost(request, env) {
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }

    try {
        const body = await request.json();
        const { title, content, excerpt, book_isbn, topic_ids } = body;

        if (!title || typeof title !== 'string' || title.trim() === '') {
            return createErrorResponse("Post title is required.", 400);
        }
        if (!content || typeof content !== 'string' || content.trim() === '') {
            return createErrorResponse("Post content is required.", 400);
        }

        const sanitizedContent = sanitizeBlogContent(content, 'default'); // Use default sanitization rules

        let bookTitle = null;
        if (book_isbn) {
            const book = await env.DB.prepare("SELECT title FROM books WHERE isbn = ?").bind(book_isbn).first();
            if (!book) {
                return createErrorResponse(`Book with ISBN ${book_isbn} not found. Cannot associate post.`, 404);
            }
            bookTitle = book.title;
        }

        // Determine initial status based on site settings for review
        const reviewSetting = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'blog_post_requires_review'").first();
        const requiresReview = reviewSetting ? (reviewSetting.setting_value === 'true') : true; // Default to requiring review if setting not found
        
        let initialStatus = 'draft'; // Default for users
        if (userVerification.role === 'admin' && body.status) { // Admin can specify status
             if (['draft', 'pending_review', 'published'].includes(body.status)) {
                initialStatus = body.status;
             } else {
                initialStatus = 'pending_review'; // Default for admin if invalid status provided
             }
        } else {
            initialStatus = requiresReview ? 'pending_review' : 'published';
        }
        
        const slug = generatePostSlug(title); // Implement or use a library for slug generation
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const publishedAt = (initialStatus === 'published') ? currentTime : null;

        // Start a transaction-like batch
        const operations = [];
        const postInsertStmt = env.DB.prepare(
            `INSERT INTO blog_posts (title, slug, content, excerpt, user_id, username, book_isbn, book_title, status, visibility, allow_comments, created_at, updated_at, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', TRUE, ?, ?, ?)`
        );
        
        // D1 doesn't return last_row_id directly from batch. We need to insert then get ID if needed for topics.
        // For simplicity now, we'll assume we might not get last_row_id easily from batch for topics.
        // A workaround: generate a UUID for the post ID application-side.
        // Or, perform operations sequentially if topic_ids are present.

        const { meta: postMeta } = await postInsertStmt.bind(
            title.trim(), slug, sanitizedContent, excerpt || null, userVerification.userId, 
            userVerification.username, // Assuming verifyUser returns username
            book_isbn || null, bookTitle || null, initialStatus, 
            currentTime, currentTime, publishedAt
        ).run();

        if (!postMeta || !postMeta.last_row_id) {
            return createErrorResponse("Failed to create post: Database error on post insertion.", 500);
        }
        const postId = postMeta.last_row_id;

        // Handle topic associations
        if (topic_ids && Array.isArray(topic_ids) && topic_ids.length > 0) {
            const topicOps = topic_ids.map(topicId => {
                if (typeof topicId === 'number' && topicId > 0) {
                    return env.DB.prepare("INSERT INTO blog_post_topics (post_id, topic_id) VALUES (?, ?)")
                               .bind(postId, topicId);
                }
                return null;
            }).filter(op => op !== null);
            
            if (topicOps.length > 0) {
                await env.DB.batch(topicOps); // Batch insert topic associations
            }
        }

        const newPost = await env.DB.prepare(
            `SELECT p.*, u.username as author_username 
             FROM blog_posts p 
             JOIN users u ON p.user_id = u.id 
             WHERE p.id = ?`
        ).bind(postId).first();

        return new Response(JSON.stringify({ success: true, message: "Post created successfully.", post: newPost }), { status: 201 });

    } catch (error) {
        console.error("Create Blog Post Error:", error);
        if (error.message.includes("UNIQUE constraint failed")) {
            return createErrorResponse("Post title might already exist (slug conflict) or other unique constraint.", 409);
        }
        return createErrorResponse("Server error: " + error.message, 500);
    }
}


export async function handleGetBlogPosts(request, env) {
    try {
        const { page, limit, offset } = getPaginationParams(request.url, 10); // Default 10 posts per page
        const url = new URL(request.url);
        
        let conditions = ["p.status = 'published'", "p.visibility = 'public'"]; // Default filters
        let queryParams = [];

        // Filter by topic_id
        const topicId = url.searchParams.get('topic_id');
        if (topicId && /^\d+$/.test(topicId)) {
            // This requires a JOIN or subquery to filter by topic
            // For simplicity now, we'll assume the JOIN is always there if filtering by topic
            // This part needs to be more robust if topic_id is optional and other filters are present
        }
        
        // Filter by book_isbn
        const bookIsbn = url.searchParams.get('book_isbn');
        if (bookIsbn) {
            conditions.push("p.book_isbn = ?");
            queryParams.push(bookIsbn);
        }
        
        // Filter by user_id (author)
        const userId = url.searchParams.get('user_id');
        if (userId && /^\d+$/.test(userId)) {
            conditions.push("p.user_id = ?");
            queryParams.push(parseInt(userId));
        }

        // Search term (title, excerpt)
        const searchTerm = url.searchParams.get('search');
        if (searchTerm) {
            conditions.push("(p.title LIKE ? OR p.excerpt LIKE ?)"); // Content search can be heavy
            queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }
        
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Query for total items
        let countSql = `
            SELECT COUNT(DISTINCT p.id) as total 
            FROM blog_posts p 
            LEFT JOIN users u ON p.user_id = u.id 
            LEFT JOIN blog_post_topics bpt ON p.id = bpt.post_id 
            ${whereClause}`;
        
        // If filtering by topic_id, add it to count query params as well
        let countQueryParams = [...queryParams];
        if (topicId) {
            countSql = countSql.replace('WHERE', `LEFT JOIN blog_topics bt ON bpt.topic_id = bt.id WHERE bt.id = ? AND `);
            if (conditions.length === 0 && whereClause === "") { // If topicId is the only filter
                 countSql = countSql.replace('WHERE bt.id = ? AND ', 'WHERE bt.id = ? ');
            }
            countQueryParams.unshift(parseInt(topicId));
        }

        const countResult = await env.DB.prepare(countSql).bind(...countQueryParams).first();
        const totalItems = countResult ? countResult.total : 0;

        // Query for data
        // For simplicity, the JOINs are always included. This can be optimized.
        // We also need to select topic names if present.
        let dataSql = `
            SELECT 
                p.id, p.title, p.slug, p.excerpt, p.user_id, p.username as post_author_username, 
                p.book_isbn, p.book_title, p.status, p.visibility, p.featured_image_url,
                p.view_count, p.like_count, p.comment_count, p.is_featured,
                STRFTIME('%Y-%m-%d %H:%M', p.published_at) as published_at_formatted, 
                STRFTIME('%Y-%m-%d %H:%M', p.created_at) as created_at_formatted,
                u.username as author_actual_username, 
                (SELECT GROUP_CONCAT(t.name) FROM blog_topics t JOIN blog_post_topics bpt_sub ON t.id = bpt_sub.topic_id WHERE bpt_sub.post_id = p.id) as topics_list
            FROM blog_posts p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN blog_post_topics bpt ON p.id = bpt.post_id 
            ${whereClause} 
            GROUP BY p.id 
            ORDER BY p.is_featured DESC, p.published_at DESC 
            LIMIT ? OFFSET ?`;

        let dataQueryParams = [...queryParams, limit, offset];
        if (topicId) {
             dataSql = dataSql.replace('WHERE', `LEFT JOIN blog_topics bt ON bpt.topic_id = bt.id WHERE bt.id = ? AND `);
             if (conditions.length === 0 && whereClause === "") {
                 dataSql = dataSql.replace('WHERE bt.id = ? AND ', 'WHERE bt.id = ? ');
             }
             dataQueryParams.unshift(parseInt(topicId));
        }
        
        const { results: posts } = await env.DB.prepare(dataSql).bind(...dataQueryParams).all();
        
        return new Response(JSON.stringify(formatPaginatedResponse(posts || [], totalItems, page, limit)), { status: 200 });

    } catch (error) {
        console.error("Get Blog Posts Error:", error);
        return createErrorResponse("Server error: " + error.message, 500);
    }
}


export async function handleGetBlogPostById(request, env, postId) {
    // postId comes from path parameter
    if (!postId || !/^\d+$/.test(postId)) {
        return createErrorResponse("Invalid Post ID format.", 400);
    }
    const numericPostId = parseInt(postId);

    try {
        // Increment view count (simple increment, no advanced duplicate prevention here)
        await env.DB.prepare("UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?").bind(numericPostId).run();

        const postQuery = `
            SELECT 
                p.*, 
                u.username as author_username_from_users_table,
                (SELECT GROUP_CONCAT(t.name) FROM blog_topics t JOIN blog_post_topics bpt ON t.id = bpt.topic_id WHERE bpt.post_id = p.id) as topics_list_str,
                (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'slug', t.slug)) FROM blog_topics t JOIN blog_post_topics bpt ON t.id = bpt.topic_id WHERE bpt.post_id = p.id) as topics_json_array
            FROM blog_posts p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ? AND p.status = 'published' AND p.visibility = 'public'`; 
            // Add more visibility checks if needed, or different logic for admins/authors viewing non-public posts

        const post = await env.DB.prepare(postQuery).bind(numericPostId).first();

        if (!post) {
            return createErrorResponse("Post not found or not publicly available.", 404);
        }
        
        // Parse topics_json_array if it's a string
        if (post.topics_json_array && typeof post.topics_json_array === 'string') {
            try {
                post.topics = JSON.parse(post.topics_json_array);
            } catch (e) {
                console.warn("Failed to parse topics_json_array for post ID:", postId, e);
                post.topics = []; // Fallback to empty array
            }
        } else if (!post.topics_json_array) {
             post.topics = [];
        }
        // delete post.topics_json_array; // Clean up the raw string

        // For simplicity, username is already on posts table, but we can verify/update from users table
        // post.author_username = post.author_username_from_users_table || post.username; 

        return new Response(JSON.stringify({ success: true, post: post }), { status: 200 });

    } catch (error) {
        console.error(`Get Blog Post By ID (ID: ${postId}) Error:`, error);
        return createErrorResponse("Server error: " + error.message, 500);
    }
}