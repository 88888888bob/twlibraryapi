// src/handlers/blogPosts.js
import { createErrorResponse } from '../utils/responseHelper.js';
import { verifyUser, verifyAdmin } from '../utils/authHelper.js';
import { sanitizeBlogContent } from '../utils/sanitizeHelper.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/paginationHelper.js';

// Helper to generate slug (simplified)
function generatePostSlug(title, existingSlug = null) {
    // If updating and slug is not meant to change with title, return existingSlug
    // This function needs a more robust unique slug generation for production
    let baseSlug = title.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w-]+/g, '')       // Remove all non-word chars
        .replace(/--+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '')             // Trim - from end of text
        .substring(0, 75);              // Max length

    // Add a short random suffix to increase uniqueness, especially if title is common
    // In a real app, you'd check DB for uniqueness and append -1, -2 etc. if needed
    return `${baseSlug}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(-2)}`;
}

// Helper function to get a post and check ownership/admin status
async function getPostAndVerifyAccess(env, postId, userId, userRole, allowAdminOverride = true) {
    if (!postId || !/^\d+$/.test(postId)) {
        return { error: createErrorResponse("Invalid Post ID format.", 400), post: null };
    }
    const numericPostId = parseInt(postId);

    const post = await env.DB.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(numericPostId).first();
    if (!post) {
        return { error: createErrorResponse("Post not found.", 404), post: null };
    }

    if (post.user_id !== userId && !(allowAdminOverride && userRole === 'admin')) {
        return { error: createErrorResponse("Forbidden: You do not have permission to access this post.", 403), post: null };
    }
    return { post, error: null };
}

// 假设 getPostTopics 辅助函数在此文件或可导入
async function getPostTopics(env, postId) {
    if (!postId) return [];
    try {
        const { results } = await env.DB.prepare(
            "SELECT t.id, t.name, t.slug FROM blog_topics t JOIN blog_post_topics bpt ON t.id = bpt.topic_id WHERE bpt.post_id = ?"
        ).bind(postId).all();
        return results || [];
    } catch (e) {
        console.error(`Error fetching topics for post ${postId}:`, e);
        return [];
    }
}



export async function handleCreateBlogPost(request, env) {
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }

    try {
        const body = await request.json();
        const { title, content, excerpt, book_isbn, topic_ids, visibility, allow_comments, featured_image_url } = body;

        if (!title || typeof title !== 'string' || title.trim() === '') {
            return createErrorResponse("Post title is required.", 400);
        }
        if (!content || typeof content !== 'string' || content.trim() === '') {
            return createErrorResponse("Post content is required.", 400);
        }

        const sanitizedContent = sanitizeBlogContent(content, 'default');

        let bookTitle = null;
        if (book_isbn && typeof book_isbn === 'string' && book_isbn.trim() !== '') {
            const book = await env.DB.prepare("SELECT title FROM books WHERE isbn = ?").bind(book_isbn.trim()).first();
            if (!book) {
                return createErrorResponse(`Book with ISBN ${book_isbn} not found.`, 404);
            }
            bookTitle = book.title;
        }

        const reviewSetting = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'blog_post_requires_review'").first();
        const requiresReview = reviewSetting ? (reviewSetting.setting_value === 'true') : true; 
        
        let initialStatus = 'draft';
        if (userVerification.role === 'admin' && body.status && ['draft', 'pending_review', 'published'].includes(body.status)) {
            initialStatus = body.status;
        } else {
            initialStatus = requiresReview ? 'pending_review' : 'published';
        }
        
        const slug = generatePostSlug(title.trim());
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const publishedAt = (initialStatus === 'published') ? currentTime : null;

        const postInsertStmt = env.DB.prepare(
            `INSERT INTO blog_posts 
             (title, slug, content, excerpt, user_id, username, book_isbn, book_title, 
              status, visibility, allow_comments, featured_image_url, created_at, updated_at, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        
        const { meta: postMeta } = await postInsertStmt.bind(
            title.trim(), slug, sanitizedContent, excerpt || null, userVerification.userId, 
            userVerification.username || 'Anonymous', // Ensure username is not undefined
            book_isbn ? book_isbn.trim() : null, bookTitle, 
            initialStatus, 
            visibility && ['public', 'private_link', 'members_only', 'unlisted'].includes(visibility) ? visibility : 'public', 
            typeof allow_comments === 'boolean' ? allow_comments : true,
            featured_image_url || null,
            currentTime, currentTime, publishedAt
        ).run();

        if (!postMeta || !postMeta.last_row_id) {
            return createErrorResponse("Failed to create post: DB error.", 500);
        }
        const postId = postMeta.last_row_id;

        if (topic_ids && Array.isArray(topic_ids) && topic_ids.length > 0) {
            const validTopicIds = topic_ids.filter(id => typeof id === 'number' && id > 0);
            if (validTopicIds.length > 0) {
                 const topicOps = validTopicIds.map(topicId => 
                    env.DB.prepare("INSERT INTO blog_post_topics (post_id, topic_id) VALUES (?, ?)").bind(postId, topicId)
                );
                await env.DB.batch(topicOps);
            }
        }

        const newPostRaw = await env.DB.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(postId).first();
        if (!newPostRaw) return createErrorResponse("Failed to retrieve newly created post.", 500);
        
        const topicsForNewPost = await getPostTopics(env, postId);
        const newPost = { ...newPostRaw, topics: topicsForNewPost, author_username: userVerification.username || 'Anonymous' };


        return new Response(JSON.stringify({ success: true, message: "Post created successfully.", post: newPost }), { status: 201 });

    } catch (error) {
        console.error("Create Blog Post Error:", error.message, error.stack);
        if (error.message.includes("UNIQUE constraint failed") && error.message.includes("slug")) {
            return createErrorResponse("A post with a similar title (resulting in a duplicate slug) might already exist. Please try a slightly different title.", 409);
        }
        return createErrorResponse("Server error during post creation: " + error.message, 500);
    }
}

export async function handleGetBlogPosts(request, env) {
    console.log("[handleGetBlogPosts] Received request to list blog posts.");
    try {
        const url = new URL(request.url);
        // 管理员视图下，前端可能会请求较大的 limit 以便进行客户端筛选，
        // 但 API 本身还是应该有合理的默认 limit 和最大 limit。
        const defaultLimit = url.searchParams.get('admin_view') === 'true' ? 200 : 10; // 管理员默认获取更多
        const maxLimit = 500; // API 允许的最大 limit
        
        let requestedLimit = parseInt(url.searchParams.get('limit')) || defaultLimit;
        if (requestedLimit > maxLimit) {
            console.warn(`[handleGetBlogPosts] Requested limit ${requestedLimit} exceeds max limit ${maxLimit}. Capping to max.`);
            requestedLimit = maxLimit;
        }
        
        const page = parseInt(url.searchParams.get('page')) || 1;
        const offset = (page > 0 ? page - 1 : 0) * requestedLimit;
        
        let conditions = [];
        let queryParams = [];
        // 基础 JOIN，用于获取作者的实际用户名
        let joins = `LEFT JOIN users u ON p.user_id = u.id`; 
        let isAdminContext = false;

        // 检查是否为管理员视图
        if (url.searchParams.get('admin_view') === 'true') {
            console.log("[handleGetBlogPosts] Admin view context requested.");
            const adminVerification = await verifyAdmin(request, env);
            if (!adminVerification.authorized) {
                console.warn("[handleGetBlogPosts] Admin view denied: Not authorized.");
                return createErrorResponse("Admin view requested but not authorized.", 403);
            }
            isAdminContext = true;
            console.log("[handleGetBlogPosts] Admin context verified.");
        }

        // 状态筛选
        const statusFilter = url.searchParams.get('status');
        if (statusFilter) {
            console.log(`[handleGetBlogPosts] Filtering by status: "${statusFilter}"`);
            if (isAdminContext || statusFilter === 'published') {
                conditions.push("p.status = ?");
                queryParams.push(statusFilter);
            } else {
                console.warn(`[handleGetBlogPosts] User attempted to filter by status "${statusFilter}" without admin rights.`);
                return createErrorResponse("Forbidden: You cannot filter by this status without admin rights.", 403);
            }
        } else if (!isAdminContext) {
            // 非管理员，默认只看公开和已发布的
            console.log("[handleGetBlogPosts] Public view, defaulting to published and public posts.");
            conditions.push("p.status = 'published'");
            conditions.push("p.visibility = 'public'");
        }
        // 管理员且无 statusFilter 时，获取所有状态

        // 话题筛选
        const topicIdStr = url.searchParams.get('topic_id');
        if (topicIdStr && /^\d+$/.test(topicIdStr)) {
            const topicId = parseInt(topicIdStr);
            console.log(`[handleGetBlogPosts] Filtering by topic_id: ${topicId}`);
            joins += ` JOIN blog_post_topics bpt ON p.id = bpt.post_id`;
            conditions.push("bpt.topic_id = ?");
            queryParams.push(topicId);
        }
        
        // 关联书籍筛选 (ISBN)
        const bookIsbnFilter = url.searchParams.get('book_isbn');
        if (bookIsbnFilter) {
            console.log(`[handleGetBlogPosts] Filtering by book_isbn: "${bookIsbnFilter}"`);
            conditions.push("p.book_isbn = ?");
            queryParams.push(bookIsbnFilter);
        }
        
        // 作者筛选 (user_id) - 通常管理员使用
        const authorIdFilter = url.searchParams.get('user_id');
        if (authorIdFilter && /^\d+$/.test(authorIdFilter) && isAdminContext) {
            console.log(`[handleGetBlogPosts] Admin filtering by author user_id: ${authorIdFilter}`);
            conditions.push("p.user_id = ?");
            queryParams.push(parseInt(authorIdFilter));
        }

        // 统一搜索 (博客标题，作者用户名，关联书籍的 ISBN)
        const searchTerm = url.searchParams.get('search');
        if (searchTerm && searchTerm.trim() !== '') {
            const trimmedSearchTerm = searchTerm.trim();
            console.log(`[handleGetBlogPosts] Searching for term: "${trimmedSearchTerm}"`);
            let searchConditions = [];
            let searchParamsLocal = [];
            const searchLike = `%${trimmedSearchTerm}%`;

            searchConditions.push("p.title LIKE ?"); searchParamsLocal.push(searchLike);
            searchConditions.push("u.username LIKE ?"); searchParamsLocal.push(searchLike); // 搜索作者用户名 (来自 users 表)
            searchConditions.push("p.username LIKE ?"); searchParamsLocal.push(searchLike); // 搜索文章表中冗余的作者名
            if (/^\d+$/.test(trimmedSearchTerm) || trimmedSearchTerm.includes('-')) { // 简单判断是否可能是 ISBN
                 searchConditions.push("p.book_isbn LIKE ?"); searchParamsLocal.push(searchLike);
            }
            conditions.push(`(${searchConditions.join(" OR ")})`);
            queryParams.push(...searchParamsLocal);
        }
        
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // 1. 获取符合当前筛选条件的总条目数 (用于分页)
        const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM blog_posts p ${joins} ${whereClause}`;
        console.log("[handleGetBlogPosts] Executing Count SQL:", countSql, "Params:", JSON.stringify(queryParams));
        const countResult = await env.DB.prepare(countSql).bind(...queryParams).first();
        const totalItems = countResult ? countResult.total : 0;
        console.log("[handleGetBlogPosts] Total filtered items found by DB:", totalItems);

        // 2. 获取数据
        // 内容预览参数 (仅限非管理员视图且明确请求时)
        const previewLengthStr = url.searchParams.get('preview_length');
        let contentSelection = "p.content"; 
        let contentAlias = "content";
        if (!isAdminContext && previewLengthStr && /^\d+$/.test(previewLengthStr)) {
            const previewLength = Math.min(Math.max(parseInt(previewLengthStr), 30), 300); // 限制预览长度 30-300
            console.log(`[handleGetBlogPosts] Content preview requested with length: ${previewLength}`);
            contentSelection = `CASE WHEN LENGTH(p.content) > ${previewLength} THEN SUBSTR(p.content, 1, ${previewLength}) || '...' ELSE p.content END`;
            contentAlias = "content_preview"; // 返回的字段名是 content_preview
        }
        
        const dataSql = `
            SELECT 
                p.id, p.title, p.slug, 
                ${contentSelection} AS ${contentAlias}, /* content 或 content_preview */
                p.excerpt, p.status, p.is_featured,
                p.user_id, p.username as post_author_username_on_post_table,
                p.book_isbn, p.book_title, 
                p.featured_image_url, p.view_count, p.like_count, p.comment_count,
                STRFTIME('%Y-%m-%d', p.published_at) as published_date,
                STRFTIME('%Y-%m-%d %H:%M', p.created_at) as created_at_formatted,
                STRFTIME('%Y-%m-%d %H:%M', p.updated_at) as updated_at_formatted,
                u.username as author_actual_username
            FROM blog_posts p
            ${joins} 
            ${whereClause} 
            GROUP BY p.id
            ORDER BY p.is_featured DESC, p.updated_at DESC, p.id DESC
            LIMIT ? OFFSET ?`;
        
        const dataQueryParams = [...queryParams, requestedLimit, offset];
        console.log("[handleGetBlogPosts] Executing Data SQL:", dataSql, "Params:", JSON.stringify(dataQueryParams));
        const { results: postsData } = await env.DB.prepare(dataSql).bind(...dataQueryParams).all();
        console.log(`[handleGetBlogPosts] Found ${postsData ? postsData.length : 0} posts for current page ${page}.`);
        
        const postsProcessed = [];
        if (postsData) {
            for (const post of postsData) {
                const topics = await getPostTopics(env, post.id);
                const finalContent = previewLengthStr && !isAdminContext ? post.content_preview : post.content; // 使用正确的字段名
                postsProcessed.push({ 
                    ...post, 
                    content: finalContent, // 确保最终返回的字段是 content
                    topics: topics || [],
                    author_username: post.author_actual_username || post.post_author_username_on_post_table || 'Unknown'
                });
            }
        }
        
        let statusCounts = null;
        if (isAdminContext) {
            console.log("[handleGetBlogPosts] Fetching status counts for admin view.");
            // ... (statusCounts 查询逻辑，与之前版本一致)
            const countsQueries = [
                env.DB.prepare("SELECT COUNT(*) as count FROM blog_posts"),
                env.DB.prepare("SELECT COUNT(*) as count FROM blog_posts WHERE status = 'published'"),
                env.DB.prepare("SELECT COUNT(*) as count FROM blog_posts WHERE status = 'draft'"),
                env.DB.prepare("SELECT COUNT(*) as count FROM blog_posts WHERE status = 'pending_review'"),
                env.DB.prepare("SELECT COUNT(*) as count FROM blog_posts WHERE status = 'archived'")
            ];
            try {
                const countsResults = await env.DB.batch(countsQueries);
                statusCounts = {
                    all: countsResults[0].results[0]?.count || 0,
                    published: countsResults[1].results[0]?.count || 0,
                    draft: countsResults[2].results[0]?.count || 0,
                    pending_review: countsResults[3].results[0]?.count || 0,
                    archived: countsResults[4].results[0]?.count || 0,
                };
                console.log("[handleGetBlogPosts] Status counts:", JSON.stringify(statusCounts));
            } catch (batchError) {
                console.error("[handleGetBlogPosts] Error fetching status counts via batch:", batchError);
            }
        }
        
        const responsePayload = formatPaginatedResponse(postsProcessed, totalItems, page, requestedLimit);
        if (statusCounts) {
            responsePayload.statusCounts = statusCounts;
        }
        console.log("[handleGetBlogPosts] Successfully prepared response payload.");
        return new Response(JSON.stringify(responsePayload), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("[handleGetBlogPosts] General Error:", error.message, error.stack);
        return createErrorResponse(`Server error while fetching blog posts: ${error.message}`, 500);
    }
}


export async function handleGetBlogPostById(request, env, postId) {
    if (!postId || !/^\d+$/.test(postId)) {
        return createErrorResponse("Invalid Post ID format.", 400);
    }
    const numericPostId = parseInt(postId);

    try {
        // Increment view count - simple increment
        await env.DB.prepare("UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?").bind(numericPostId).run();

        const postQuery = `
            SELECT p.*, u.username as author_actual_username
            FROM blog_posts p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ?`; 
        
        let post = await env.DB.prepare(postQuery).bind(numericPostId).first();

        if (!post) {
            return createErrorResponse("Post not found.", 404);
        }

        // Check visibility for non-authors/non-admins
        const userVerification = await verifyUser(request, env); // Check if a user is logged in
        if (post.status !== 'published' || (post.visibility !== 'public' && post.visibility !== 'unlisted')) {
            if (!userVerification.authorized || (post.user_id !== userVerification.userId && userVerification.role !== 'admin')) {
                 return createErrorResponse("Post not found or you do not have permission to view it.", 404);
            }
        }
        
        const topics = await getPostTopics(env, numericPostId);
        post = { 
            ...post, 
            topics: topics,
            author_username: post.author_actual_username || post.username || 'Unknown' // post.username is from blog_posts table
        };
        // delete post.author_actual_username; // Clean up if needed

        return new Response(JSON.stringify({ success: true, post: post }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Get Blog Post By ID (ID: ${postId}) Error:`, error.message, error.stack);
        return createErrorResponse("Server error fetching post details: " + error.message, 500);
    }
}


export async function handleUpdateBlogPost(request, env, postId) {
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }

    const { post: existingPost, error: accessError } = await getPostAndVerifyAccess(env, postId, userVerification.userId, userVerification.role);
    if (accessError) return accessError;

    try {
        const body = await request.json();
        const { title, content, excerpt, book_isbn, topic_ids, status, visibility, allow_comments, featured_image_url } = body;

        const updateFields = [];
        const params = [];
        
        if (title !== undefined && title.trim() !== existingPost.title) {
            if (title.trim() === '') return createErrorResponse("Title cannot be empty.", 400);
            updateFields.push("title = ?"); params.push(title.trim());
            // Optionally regenerate slug, or keep it stable
            // updateFields.push("slug = ?"); params.push(generatePostSlug(title.trim(), existingPost.slug));
        }
        if (content !== undefined) { // Always sanitize if content is provided
            const sanitizedContent = sanitizeBlogContent(content, 'default');
            updateFields.push("content = ?"); params.push(sanitizedContent);
        }
        if (excerpt !== undefined) {
            updateFields.push("excerpt = ?"); params.push(excerpt || null);
        }

        if (book_isbn !== undefined) {
            if (book_isbn && book_isbn.trim() !== '') {
                const book = await env.DB.prepare("SELECT title FROM books WHERE isbn = ?").bind(book_isbn.trim()).first();
                if (!book) return createErrorResponse(`Book with ISBN ${book_isbn} not found.`, 404);
                updateFields.push("book_isbn = ?"); params.push(book_isbn.trim());
                updateFields.push("book_title = ?"); params.push(book.title);
            } else { // Clearing book association
                updateFields.push("book_isbn = NULL");
                updateFields.push("book_title = NULL");
            }
        }
        
        if (status !== undefined && status !== existingPost.status) {
            const allowedUserStatuses = ['draft', 'pending_review']; // User can request review
            const allowedAdminStatuses = ['draft', 'pending_review', 'published', 'archived'];
            let newStatus = existingPost.status;

            if (userVerification.role === 'admin' && allowedAdminStatuses.includes(status)) {
                newStatus = status;
            } else if (userVerification.userId === existingPost.user_id && allowedUserStatuses.includes(status)) {
                // If user changes from published to draft/pending, it's allowed
                // If site requires review, user cannot directly publish
                const reviewSetting = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'blog_post_requires_review'").first();
                const requiresReview = reviewSetting ? (reviewSetting.setting_value === 'true') : true;
                if (status === 'published' && requiresReview && userVerification.role !== 'admin') {
                    newStatus = 'pending_review'; // Force to pending if user tries to publish and review is on
                } else {
                    newStatus = status;
                }
            } else if (userVerification.userId === existingPost.user_id && status === 'published' && existingPost.status !== 'published') {
                // User trying to publish
                const reviewSetting = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'blog_post_requires_review'").first();
                const requiresReview = reviewSetting ? (reviewSetting.setting_value === 'true') : true;
                newStatus = requiresReview ? 'pending_review' : 'published';
            }
             else if (userVerification.userId === existingPost.user_id) { // User changing own post but to invalid status
                return createErrorResponse(`Invalid status transition. You can set to: ${allowedUserStatuses.join('/')}.`, 403);
            }
            // If no valid status change occurred due to permissions, newStatus remains existingPost.status

            if (newStatus !== existingPost.status) {
                updateFields.push("status = ?"); params.push(newStatus);
                if (newStatus === 'published' && !existingPost.published_at) { // First time publishing
                    updateFields.push("published_at = ?"); params.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
                } else if (newStatus !== 'published' && existingPost.published_at && existingPost.status === 'published') {
                    // If unpublishing a published post, decide whether to clear published_at
                    // updateFields.push("published_at = NULL"); // Optional
                }
            }
        }

        if (visibility !== undefined && ['public', 'private_link', 'members_only', 'unlisted'].includes(visibility)) {
            updateFields.push("visibility = ?"); params.push(visibility);
        }
        if (typeof allow_comments === 'boolean') {
            updateFields.push("allow_comments = ?"); params.push(allow_comments ? 1 : 0);
        }
        if (featured_image_url !== undefined) {
            updateFields.push("featured_image_url = ?"); params.push(featured_image_url || null);
        }

        if (updateFields.length === 0 && topic_ids === undefined) { // Check if only topics might change
             const currentTopics = (await getPostTopics(env, existingPost.id)).map(t => t.id).sort();
             if (topic_ids === undefined || (Array.isArray(topic_ids) && JSON.stringify(topic_ids.sort()) === JSON.stringify(currentTopics))) {
                return createErrorResponse("No changes detected to update.", 304);
             }
        }
        
        // Handle topic associations
        if (topic_ids !== undefined && Array.isArray(topic_ids)) {
            await env.DB.prepare("DELETE FROM blog_post_topics WHERE post_id = ?").bind(existingPost.id).run();
            const validTopicIds = topic_ids.filter(id => typeof id === 'number' && id > 0);
            if (validTopicIds.length > 0) {
                const topicOps = validTopicIds.map(topicId => 
                    env.DB.prepare("INSERT INTO blog_post_topics (post_id, topic_id) VALUES (?, ?)").bind(existingPost.id, topicId)
                );
               if (topicOps.length > 0) await env.DB.batch(topicOps);
            }
        }
        
        if (updateFields.length > 0) {
            updateFields.push("updated_at = ?");
            params.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
            params.push(existingPost.id);
            const updateQuery = `UPDATE blog_posts SET ${updateFields.join(", ")} WHERE id = ?`;
            await env.DB.prepare(updateQuery).bind(...params).run();
        }

        const updatedPostRaw = await env.DB.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(existingPost.id).first();
        const updatedTopics = await getPostTopics(env, existingPost.id);
        const finalUpdatedPost = { ...updatedPostRaw, topics: updatedTopics, author_username: userVerification.username || 'Anonymous'};

        return new Response(JSON.stringify({ success: true, message: "Post updated successfully.", post: finalUpdatedPost }), { status: 200 });

    } catch (error) {
        console.error(`Update Blog Post (ID: ${postId}) Error:`, error.message, error.stack);
        return createErrorResponse("Server error during post update: " + error.message, 500);
    }
}


export async function handleDeleteBlogPost(request, env, postId) {
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }

    const { post: postToDelete, error: accessError } = await getPostAndVerifyAccess(env, postId, userVerification.userId, userVerification.role);
    if (accessError) return accessError;

    try {
        // Consider soft delete: UPDATE blog_posts SET status = 'archived' WHERE id = ?
        // For hard delete:
        const deleteOperations = [
            env.DB.prepare("DELETE FROM blog_post_topics WHERE post_id = ?").bind(postToDelete.id),
            env.DB.prepare("DELETE FROM blog_post_likes WHERE post_id = ?").bind(postToDelete.id),
            // env.DB.prepare("DELETE FROM blog_comments WHERE post_id = ?").bind(postToDelete.id), // If comments exist
            env.DB.prepare("DELETE FROM blog_posts WHERE id = ?").bind(postToDelete.id)
        ];
        
        await env.DB.batch(deleteOperations);
        // Note: D1 batch returns an array of results. Need to check if post deletion was successful.
        // For simplicity, we assume if it reaches here without error, it's done.
        // A more robust check would inspect the result of the last operation.

        return new Response(JSON.stringify({ success: true, message: "Post deleted successfully." }), { status: 200 });
        // Or status 204 No Content
    } catch (error) {
        console.error(`Delete Blog Post (ID: ${postId}) Error:`, error.message, error.stack);
        return createErrorResponse("Server error during post deletion: " + error.message, 500);
    }
}


export async function handleLikeBlogPost(request, env, postId) {
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }

    if (!postId || !/^\d+$/.test(postId)) {
        return createErrorResponse("Invalid Post ID format.", 400);
    }
    const numericPostId = parseInt(postId);

    try {
        const post = await env.DB.prepare("SELECT id, like_count FROM blog_posts WHERE id = ? AND status = 'published'")
            .bind(numericPostId).first();
        if (!post) {
            return createErrorResponse("Post not found or not published.", 404);
        }

        const existingLike = await env.DB.prepare("SELECT post_id FROM blog_post_likes WHERE user_id = ? AND post_id = ?")
            .bind(userVerification.userId, numericPostId).first();
        
        if (existingLike) {
            return new Response(JSON.stringify({ success: true, message: "You have already liked this post.", like_count: post.like_count || 0 }), { status: 200 });
        }

        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const newLikeCount = (post.like_count || 0) + 1;

        await env.DB.batch([
            env.DB.prepare("INSERT INTO blog_post_likes (user_id, post_id, created_at) VALUES (?, ?, ?)")
                  .bind(userVerification.userId, numericPostId, currentTime),
            env.DB.prepare("UPDATE blog_posts SET like_count = ? WHERE id = ?")
                  .bind(newLikeCount, numericPostId)
        ]);
        
        return new Response(JSON.stringify({ success: true, message: "Post liked successfully.", like_count: newLikeCount }), { status: 200 });

    } catch (error) {
        console.error(`Like Blog Post (ID: ${postId}) Error:`, error.message, error.stack);
        if (error.message.includes("UNIQUE constraint failed")) {
            const post = await env.DB.prepare("SELECT like_count FROM blog_posts WHERE id = ?").bind(numericPostId).first();
            return new Response(JSON.stringify({ success: true, message: "You have already liked this post (constraint).", like_count: post ? post.like_count : 0 }), { status: 409 });
        }
        return createErrorResponse("Server error while liking post: " + error.message, 500);
    }
}


export async function handleUnlikeBlogPost(request, env, postId) {
    const userVerification = await verifyUser(request, env);
    if (!userVerification.authorized) {
        return createErrorResponse(userVerification.error, 401);
    }
    if (!postId || !/^\d+$/.test(postId)) {
        return createErrorResponse("Invalid Post ID format.", 400);
    }
    const numericPostId = parseInt(postId);

    try {
        const post = await env.DB.prepare("SELECT id, like_count FROM blog_posts WHERE id = ?").bind(numericPostId).first();
        if (!post) {
            return createErrorResponse("Post not found.", 404);
        }

        const deleteLikeResult = await env.DB.prepare("DELETE FROM blog_post_likes WHERE user_id = ? AND post_id = ?")
            .bind(userVerification.userId, numericPostId).run();

        if (deleteLikeResult.meta.changes > 0) {
            const newLikeCount = Math.max(0, (post.like_count || 0) - 1);
            await env.DB.prepare("UPDATE blog_posts SET like_count = ? WHERE id = ?")
                .bind(newLikeCount, numericPostId).run();
            return new Response(JSON.stringify({ success: true, message: "Post unliked successfully.", like_count: newLikeCount }), { status: 200 });
        } else {
            return new Response(JSON.stringify({ success: true, message: "You had not liked this post, or it was already unliked.", like_count: post.like_count || 0 }), { status: 200 });
        }
    } catch (error) {
        console.error(`Unlike Blog Post (ID: ${postId}) Error:`, error.message, error.stack);
        return createErrorResponse("Server error while unliking post: " + error.message, 500);
    }
}

export async function handleAdminUpdatePostStatus(request, env, postId) {
    const adminVerification = await verifyAdmin(request, env); // 必须是管理员
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, 401);
    }

    if (!postId || !/^\d+$/.test(postId)) {
        return createErrorResponse("Invalid Post ID format.", 400);
    }
    const numericPostId = parseInt(postId);

    try {
        const post = await env.DB.prepare("SELECT id, status, published_at FROM blog_posts WHERE id = ?")
            .bind(numericPostId).first();
        if (!post) {
            return createErrorResponse("Post not found.", 404);
        }

        const { status: newStatus } = await request.json();
        const allowedAdminStatuses = ['draft', 'pending_review', 'published', 'archived'];

        if (!newStatus || !allowedAdminStatuses.includes(newStatus)) {
            return createErrorResponse(`Invalid status value. Allowed statuses are: ${allowedAdminStatuses.join(', ')}.`, 400);
        }

        if (newStatus === post.status) {
            return createErrorResponse("Post is already in the requested status.", 304); // Or 200 with message
        }

        const updateFields = ["status = ?"];
        const params = [newStatus];
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (newStatus === 'published' && !post.published_at) { // First time publishing
            updateFields.push("published_at = ?");
            params.push(currentTime);
        } else if (newStatus !== 'published' && post.status === 'published' && post.published_at) {
            // If unpublishing a published post, admin might choose to clear published_at or not
            // For now, we don't clear it automatically. If needed, can add a flag in request.
        }
        
        updateFields.push("updated_at = ?");
        params.push(currentTime);
        params.push(numericPostId);

        const query = `UPDATE blog_posts SET ${updateFields.join(", ")} WHERE id = ?`;
        const { success, meta } = await env.DB.prepare(query).bind(...params).run();

        if (success && meta.changes > 0) {
            const updatedPost = await env.DB.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(numericPostId).first();
             // Fetch topics for the updated post to return complete data
            const topics = await getPostTopics(env, numericPostId);
            const finalPost = { ...updatedPost, topics: topics, author_username: updatedPost.username };


            return new Response(JSON.stringify({ success: true, message: `Post status updated to '${newStatus}'.`, post: finalPost }), { status: 200 });
        } else if (meta.changes === 0 && newStatus !== post.status) {
            // This case should ideally not be hit if the status check above is correct,
            // but as a fallback if DB didn't update for some reason.
            return createErrorResponse("Failed to update post status (no rows affected).", 500);
        } else { // meta.changes === 0 because status was already the same (caught above)
            return createErrorResponse("Failed to update post status.", 500);
        }

    } catch (error) {
        console.error(`Admin Update Post Status (ID: ${postId}) Error:`, error.message, error.stack);
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return createErrorResponse("Invalid request body: Malformed JSON.", 400);
        }
        return createErrorResponse("Server error during status update: " + error.message, 500);
    }
}

export async function handleAdminTogglePostFeature(request, env, postId) {
    const adminVerification = await verifyAdmin(request, env);
    if (!adminVerification.authorized) {
        return createErrorResponse(adminVerification.error, 401);
    }
    if (!postId || !/^\d+$/.test(postId)) {
        return createErrorResponse("Invalid Post ID format.", 400);
    }
    const numericPostId = parseInt(postId);

    try {
        const post = await env.DB.prepare("SELECT id, is_featured FROM blog_posts WHERE id = ?")
            .bind(numericPostId).first();
        if (!post) {
            return createErrorResponse("Post not found.", 404);
        }

        const newFeaturedStatus = !post.is_featured; // 切换状态
        // 如果使用 priority，逻辑会更复杂，可能需要设置一个非零值或 0
        
        const { success, meta } = await env.DB.prepare(
            "UPDATE blog_posts SET is_featured = ?, updated_at = STRFTIME('%Y-%m-%d %H:%M:%S', 'now', 'localtime') WHERE id = ?"
        ).bind(newFeaturedStatus ? 1 : 0, numericPostId).run();

        if (success && meta.changes > 0) {
            return new Response(JSON.stringify({ 
                success: true, 
                message: `Post ${newFeaturedStatus ? 'featured' : 'unfeatured'} successfully.`,
                is_featured: newFeaturedStatus
            }), { status: 200 });
        } else {
            return createErrorResponse("Failed to update post feature status.", 500);
        }
    } catch (error) {
        console.error(`Admin Toggle Post Feature (ID: ${postId}) Error:`, error.message, error.stack);
        return createErrorResponse("Server error: " + error.message, 500);
    }
}

