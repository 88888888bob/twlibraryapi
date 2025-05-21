// src/index.js

// --- 辅助函数导入 ---
import { createErrorResponse } from './utils/responseHelper.js';

// --- Handler 导入 ---
// 认证
import { 
    handleRegister, 
    handleLogin, 
    handleGetUser, 
    handlePostUser 
} from './handlers/auth.js';

// 图书 (管理员和博客用)
import { 
    handleAddBook, 
    handleEditBook, 
    handleDeleteBook, 
    handleSearchBook,       // 管理员/登录用户的图书搜索
    handleBorrowBook, 
    handleReturnBook,
    handleBlogSearchBooks   // 博客模块专用的简化版图书搜索
} from './handlers/books.js';

// 图书馆管理 (旧路径)
import { handleAdminLibrary } from './handlers/libraryAdmin.js';

// 用户管理 (Admin)
import { 
    handleAdminGetUsers, 
    handleAdminGetUserById, 
    handleAdminCreateUser, 
    handleAdminUpdateUser, 
    handleAdminDeleteUser 
} from './handlers/userAdmin.js';

// 统计
import { 
    handleGetTopBorrowers, 
    handleAdminGetStats 
} from './handlers/stats.js';

// 网站设置
import { 
    handleGetSiteSetting, 
    handleAdminGetAllSiteSettings, 
    handleAdminUpdateSiteSetting 
} from './handlers/settings.js';

// 博客话题 (确保只导入一次)
import { 
    handleAdminCreateTopic, // 管理员创建话题
    handleGetTopics,        // 公开获取话题列表
    handleAdminUpdateTopic, // 管理员编辑话题 (来自阶段 3)
    handleAdminDeleteTopic  // 管理员删除话题 (来自阶段 3)
} from './handlers/blogTopics.js';

// 博客文章 (确保只导入一次)
import { 
    handleCreateBlogPost, 
    handleGetBlogPosts, 
    handleGetBlogPostById,
    handleUpdateBlogPost,     // 编辑文章
    handleDeleteBlogPost,     // 删除文章
    handleLikeBlogPost,       // 点赞文章
    handleUnlikeBlogPost,     // 取消点赞文章
    handleAdminUpdatePostStatus, // 管理员修改文章状态 (来自阶段 3)
    handleAdminTogglePostFeature // 管理员推荐/取消推荐文章 (来自阶段 3)
} from './handlers/blogPosts.js';


export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        console.log(`[WORKER ENTRY] ${new Date().toISOString()} - ${method} ${path}`);

        // CORS Preflight Request Handling
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204, // No Content
                headers: {
                    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*', // 生产环境应指定具体源
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Requested-With',
                    'Access-Control-Allow-Credentials': 'true',
                    'Access-Control-Max-Age': '86400', // Cache preflight for 1 day
                },
            });
        }

        let response;

        try {
            // --- 路由分发 ---

            // 1. 用户认证 API (/api/auth/* 可能是更好的前缀)
            if (path === '/api/register' && method === 'POST') {
                response = await handleRegister(request, env);
            } else if (path === '/api/login' && method === 'POST') {
                response = await handleLogin(request, env);
            } else if (path === '/api/user' && method === 'GET') { // 获取当前登录用户信息
                response = await handleGetUser(request, env);
            } else if (path === '/api/user' && method === 'POST') { // (假设用于管理员验证，可考虑移除或重构)
                response = await handlePostUser(request, env);
            }

            // 2. 图书管理 API (管理员或特定权限用户)
            // 建议将这些路径统一前缀，例如 /api/admin/books/* 或 /api/books/* 并通过权限区分
            else if (path === '/addbooks' && method === 'POST') { // 旧路径，考虑迁移到 /api/books
                response = await handleAddBook(request, env);
            } else if (path.startsWith('/editbook/') && method === 'PUT') { // 旧路径，考虑迁移到 /api/books/:isbn
                const isbn = path.substring('/editbook/'.length);
                if (isbn) response = await handleEditBook(request, env, isbn);
                else response = createErrorResponse("ISBN missing for editbook.", 400);
            } else if (path === '/deletebooks' && method === 'DELETE') { // 旧路径，考虑迁移到 /api/books (带 ISBN в body) 或 /api/books/:isbn
                response = await handleDeleteBook(request, env);
            } else if (path === '/searchbooks' && method === 'GET') { // 旧路径，考虑迁移到 /api/books/search 或 /api/books
                response = await handleSearchBook(request, env);
            } else if (path === '/borrowbooks' && method === 'POST') { // 旧路径，考虑迁移到 /api/books/borrow
                response = await handleBorrowBook(request, env);
            } else if (path === '/returnbooks' && method === 'PUT') { // 旧路径，考虑迁移到 /api/books/return
                response = await handleReturnBook(request, env);
            }

            // 3. 图书馆管理子功能 (managebooks - 旧路径)
            else if (path === '/managebooks' && method === 'GET') {
                response = await handleAdminLibrary(request, env);
            }

            // 4. 管理员 - 用户管理 API (/api/admin/users/*)
            else if (path.startsWith('/api/admin/users')) {
                const userIdMatch = path.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
                if (method === 'GET') {
                    response = userIdMatch ? await handleAdminGetUserById(request, env, userIdMatch[1]) 
                                           : await handleAdminGetUsers(request, env);
                } else if (method === 'POST' && path === '/api/admin/users') {
                    response = await handleAdminCreateUser(request, env);
                } else if (method === 'PUT' && userIdMatch) {
                    response = await handleAdminUpdateUser(request, env, userIdMatch[1]);
                } else if (method === 'DELETE' && userIdMatch) {
                    response = await handleAdminDeleteUser(request, env, userIdMatch[1]);
                }
            }

            // 5. 网站设置 API
            else if (path.startsWith('/api/settings/')) { // 公开获取单个设置
                const settingKey = path.substring('/api/settings/'.length);
                if (method === 'GET' && settingKey && settingKey.trim() !== "") {
                    response = await handleGetSiteSetting(request, env, settingKey);
                } else {
                    response = createErrorResponse("Valid setting key required for GET /api/settings/:key.", 400);
                }
            } else if (path.startsWith('/api/admin/settings')) { // 管理员操作设置
                const settingKeyMatch = path.match(/^\/api\/admin\/settings\/([a-zA-Z0-9_.-]+)$/);
                if (method === 'GET' && path === '/api/admin/settings') { // GET all settings for admin
                    response = await handleAdminGetAllSiteSettings(request, env);
                } else if (method === 'PUT' && settingKeyMatch) { // PUT /api/admin/settings/:setting_key
                    response = await handleAdminUpdateSiteSetting(request, env, settingKeyMatch[1]);
                }
            }
            
            // 6. 统计 API
            else if (path === '/api/admin/stats' && method === 'GET') {
                response = await handleAdminGetStats(request, env);
            } else if (path === '/api/stats/top-borrowers' && method === 'GET') {
                response = await handleGetTopBorrowers(request, env);
            }

            // 7. 博客系统 API
            // 7.1 博客话题
            else if (path === '/api/admin/blog/topics' && method === 'POST') {
                response = await handleAdminCreateTopic(request, env);
            } else if (path.startsWith('/api/admin/blog/topics/')) {
                const topicIdMatch = path.match(/^\/api\/admin\/blog\/topics\/(\d+)$/);
                if (topicIdMatch) {
                    const topicId = topicIdMatch[1];
                    if (method === 'PUT') response = await handleAdminUpdateTopic(request, env, topicId); // 新增
                    else if (method === 'DELETE') response = await handleAdminDeleteTopic(request, env, topicId); // 新增
                }
            } else if (path === '/api/blog/topics' && method === 'GET') { // 公开列表
                response = await handleGetTopics(request, env);
            }
            // 7.2 博客用书籍搜索 (简化版)
            else if (path === '/api/blog/search-books' && method === 'GET') {
                response = await handleBlogSearchBooks(request, env);
            }
            // 7.3 博客文章
            else if (path === '/api/blog/posts' && method === 'POST') {
                response = await handleCreateBlogPost(request, env);
            } else if (path === '/api/blog/posts' && method === 'GET') {
                response = await handleGetBlogPosts(request, env);
            } else if (path.startsWith('/api/blog/posts/')) {
                const postIdSegment = path.substring('/api/blog/posts/'.length);
                const segments = postIdSegment.split('/');
                const postId = segments[0];
                const action = segments[1]; 

                if (postId && /^\d+$/.test(postId)) {
                    if (action === 'like') {
                        if (method === 'POST') response = await handleLikeBlogPost(request, env, postId);
                        else if (method === 'DELETE') response = await handleUnlikeBlogPost(request, env, postId);
                    } else if (action === 'status' && path.startsWith(`/api/admin/blog/posts/${postId}/status`)) { // 管理员修改状态
                         if (method === 'PUT') response = await handleAdminUpdatePostStatus(request, env, postId); // 新增
                    } else if (!action) { // /api/blog/posts/:postId
                        if (method === 'GET') response = await handleGetBlogPostById(request, env, postId);
                        else if (method === 'PUT') response = await handleUpdateBlogPost(request, env, postId);
                        else if (method === 'DELETE') response = await handleDeleteBlogPost(request, env, postId);
                    }
                }
            }
            
            // --- End of API Routes ---

            // 如果没有匹配到任何已知路由
            if (!response) {
                console.warn(`[WORKER ROUTER] No route matched for ${method} ${path}`);
                response = createErrorResponse(`Endpoint not found: ${method} ${path}`, 404);
            }

        } catch (e) {
            // 捕获所有在路由或 handler 中未被捕获的意外错误
            console.error(`[WORKER ERROR] Unhandled exception for ${method} ${path}:`, e.message, e.stack);
            response = createErrorResponse(`An unexpected server error occurred. Please try again later. Ray ID: ${request.headers.get('cf-ray') || 'N/A'}`, 500);
        }

        // 为所有实际响应添加 CORS 头部
        // 克隆响应以修改头部，因为 Response.headers 是不可变的
        const finalResponse = new Response(response.body, response);
        finalResponse.headers.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*'); // 生产中应指定具体源
        finalResponse.headers.set('Access-Control-Allow-Credentials', 'true');
        // 如果你从 Worker 返回了自定义头部并希望前端 JS 能访问它们，需要在这里暴露
        // finalResponse.headers.append('Access-Control-Expose-Headers', 'X-My-Custom-Header, X-Pagination-Total-Count');
        
        return finalResponse;
    },
};