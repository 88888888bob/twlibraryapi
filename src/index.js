// src/index.js

// 辅助函数导入
import { createErrorResponse } from './utils/responseHelper.js';

// Handler 导入
import { handleRegister, handleLogin, handleGetUser, handlePostUser } from './handlers/auth.js';
import { 
    handleAddBook, handleEditBook, handleDeleteBook, handleSearchBook, 
    handleBorrowBook, handleReturnBook 
} from './handlers/books.js';
import { handleAdminLibrary } from './handlers/libraryAdmin.js';
import { 
    handleAdminGetUsers, handleAdminGetUserById, handleAdminCreateUser, 
    handleAdminUpdateUser, handleAdminDeleteUser 
} from './handlers/userAdmin.js';
import { handleGetTopBorrowers, handleAdminGetStats } from './handlers/stats.js';
import { 
    handleGetSiteSetting, handleAdminGetAllSiteSettings, handleAdminUpdateSiteSetting 
} from './handlers/settings.js';

import { handleAdminCreateTopic, handleGetTopics } from './handlers/blogTopics.js';
import { handleBlogSearchBooks } from './handlers/books.js'; // 从 books.js 导入
import { handleCreateBlogPost, handleGetBlogPosts, handleGetBlogPostById } from './handlers/blogPosts.js';


export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // CORS Preflight
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Requested-With',
                    'Access-Control-Allow-Credentials': 'true',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        let response;

        // --- 路由逻辑 ---
        try {
            // 1. Auth API
            if (path === '/api/register' && method === 'POST') response = await handleRegister(request, env);
            else if (path === '/api/login' && method === 'POST') response = await handleLogin(request, env);
            else if (path === '/api/user' && method === 'GET') response = await handleGetUser(request, env);
            // else if (path === '/api/user' && method === 'POST') response = await handlePostUser(request, env); // If still needed

            // 2. Books API
            else if (path === '/addbooks' && method === 'POST') response = await handleAddBook(request, env); // Legacy path? Or /api/books
            else if (path.startsWith('/editbook/') && method === 'PUT') { // Legacy path? Or /api/books/:isbn
                const isbn = path.substring('/editbook/'.length);
                response = await handleEditBook(request, env, isbn);
            }
            else if (path === '/deletebooks' && method === 'DELETE') response = await handleDeleteBook(request, env); // Legacy? Or /api/books
            else if (path === '/searchbooks' && method === 'GET') response = await handleSearchBook(request, env); // Legacy? Or /api/books
            else if (path === '/borrowbooks' && method === 'POST') response = await handleBorrowBook(request, env); // Legacy?
            else if (path === '/returnbooks' && method === 'PUT') response = await handleReturnBook(request, env); // Legacy?
            
            // 3. Library Admin API (managebooks)
            else if (path === '/managebooks' && method === 'GET') response = await handleAdminLibrary(request, env); // Legacy?

            // 4. Admin User Management API
            else if (path.startsWith('/api/admin/users')) {
                const userIdMatch = path.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
                if (method === 'GET') {
                    response = userIdMatch ? await handleAdminGetUserById(request, env, userIdMatch[1]) : await handleAdminGetUsers(request, env);
                } else if (method === 'POST' && !userIdMatch) response = await handleAdminCreateUser(request, env);
                else if (method === 'PUT' && userIdMatch) response = await handleAdminUpdateUser(request, env, userIdMatch[1]);
                else if (method === 'DELETE' && userIdMatch) response = await handleAdminDeleteUser(request, env, userIdMatch[1]);
            }

            // 5. Settings API
            else if (path.startsWith('/api/settings/')) { // Public get single setting
                const settingKeyFromPath = path.substring('/api/settings/'.length);
                console.log(`[ROUTER /api/settings/] Path: "${path}", Extracted key: "${settingKeyFromPath}"`);
                if (method === 'GET' && settingKeyFromPath && settingKeyFromPath.trim() !== "") { // 确保不为空
                    response = await handleGetSiteSetting(request, env, settingKeyFromPath);
                } else {
                    console.warn(`[ROUTER /api/settings/] Invalid or missing settingKey: "${settingKeyFromPath}"`);
                    response = createErrorResponse("Valid setting key is required in the path.", 400);
                }
                // const settingKey = path.substring('/api/settings/'.length);
                // if (method === 'GET' && settingKey) response = await handleGetSiteSetting(request, env, settingKey);
            } else if (path.startsWith('/api/admin/settings')) { // Admin settings
                const settingKeyMatch = path.match(/^\/api\/admin\/settings\/([a-zA-Z0-9_.-]+)$/);
                if (method === 'GET' && !settingKeyMatch) response = await handleAdminGetAllSiteSettings(request, env);
                else if (method === 'PUT' && settingKeyMatch) response = await handleAdminUpdateSiteSetting(request, env, settingKeyMatch[1]);
            }

            // 6. Stats API
            else if (path === '/api/admin/stats' && method === 'GET') response = await handleAdminGetStats(request, env);
            else if (path === '/api/stats/top-borrowers' && method === 'GET') response = await handleGetTopBorrowers(request, env);

            // 7. (未来) Blog API - 示例占位
            // else if (path.startsWith('/api/blog/posts')) {
            //    if (method === 'GET') response = await handleGetBlogPosts(request, env); // from ./handlers/blog.js
            // }
            // --- NEW: Blog API Routes ---
            // Topics
            else if (path === '/api/admin/blog/topics' && method === 'POST') { // Admin creates topic
                response = await handleAdminCreateTopic(request, env);
            } else if (path === '/api/blog/topics' && method === 'GET') { // Public list topics
                response = await handleGetTopics(request, env);
            }
            // Book Search for Blog
            else if (path === '/api/blog/search-books' && method === 'GET') { // User searches books while writing post
                response = await handleBlogSearchBooks(request, env);
            }
            // Blog Posts
            else if (path === '/api/blog/posts' && method === 'POST') { // User creates post
                response = await handleCreateBlogPost(request, env);
            } else if (path === '/api/blog/posts' && method === 'GET') { // Public list posts
                response = await handleGetBlogPosts(request, env);
            } else if (path.startsWith('/api/blog/posts/')) {
                const postIdMatch = path.match(/^\/api\/blog\/posts\/(\d+)$/); // Matches /api/blog/posts/{postId}
                if (postIdMatch && method === 'GET') { // Public get single post
                    response = await handleGetBlogPostById(request, env, postIdMatch[1]);
                }
                // Add PUT (edit) and DELETE routes here later
            }
            // --- Blog Posts Routes (Updated) ---
            else if (path === '/api/blog/posts' && method === 'POST') {
                response = await handleCreateBlogPost(request, env);
            } else if (path === '/api/blog/posts' && method === 'GET') {
                response = await handleGetBlogPosts(request, env);
            } else if (path.startsWith('/api/blog/posts/')) {
                const postIdMatch = path.match(/^\/api\/blog\/posts\/(\d+)$/); // For /:postId
                const likeMatch = path.match(/^\/api\/blog\/posts\/(\d+)\/like$/); // For /:postId/like

                if (postIdMatch && method === 'GET') { // GET /api/blog/posts/:postId
                    response = await handleGetBlogPostById(request, env, postIdMatch[1]);
                } else if (postIdMatch && method === 'PUT') { // PUT /api/blog/posts/:postId
                    response = await handleUpdateBlogPost(request, env, postIdMatch[1]);
                } else if (postIdMatch && method === 'DELETE') { // DELETE /api/blog/posts/:postId
                    response = await handleDeleteBlogPost(request, env, postIdMatch[1]);
                } else if (likeMatch) { // Matches /api/blog/posts/{postId}/like
                    const postId = likeMatch[1];
                    if (method === 'POST') response = await handleLikeBlogPost(request, env, postId); // 新增点赞
                    else if (method === 'DELETE') response = await handleUnlikeBlogPost(request, env, postId); // 新增取消点赞
                }
                
            }


            // Fallback for unhandled paths
            if (!response) {
                response = createErrorResponse("Endpoint not found.", 404);
            }
        } catch (e) {
            // Catch any unhandled errors from handlers (though they should ideally handle their own)
            console.error("Unhandled error in fetch handler:", e);
            response = createErrorResponse("An unexpected server error occurred.", 500);
        }


        // Apply CORS headers to the final response
        const finalResponse = new Response(response.body, response);
        finalResponse.headers.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
        finalResponse.headers.set('Access-Control-Allow-Credentials', 'true');
        // Add other headers if needed, like 'Vary: Origin' if origin is not '*'
        
        return finalResponse;
    },
};