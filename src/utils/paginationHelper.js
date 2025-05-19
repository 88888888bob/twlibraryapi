// src/utils/paginationHelper.js
export function getPaginationParams(requestUrl, defaultLimit = 10) {
    const url = new URL(requestUrl); // requestUrl should be the full URL string
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || defaultLimit;
    const offset = (page > 0 ? page - 1 : 0) * limit; // Ensure page is positive
    return { page, limit, offset };
}

export function formatPaginatedResponse(data, totalItems, page, limit) {
    const totalPages = Math.ceil(totalItems / limit);
    return {
        success: true,
        data: data,
        pagination: {
            currentPage: page,
            itemsPerPage: limit,
            totalItems: totalItems,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        }
    };
}