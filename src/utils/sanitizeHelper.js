// src/utils/sanitizeHelper.js
import sanitizeHtml from 'sanitize-html';

// 默认的、相对宽松的配置 (适用于新闻、评论等，需要你根据 Quill 输出仔细调整)
const defaultSanitizeOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
        'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 's', 'code', 'hr', 'br',
        'span', 'pre', 'img', 'figure', 'figcaption', // figure/figcaption for images if Quill uses them
        // KaTeX/Formula related tags (often complex spans with specific classes)
        // Example: 'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mtable', 'mtr', 'mtd'
        // It's often better to allow span with specific classes for KaTeX.
    ],
    allowedAttributes: {
        'a': ['href', 'name', 'target', 'rel', 'title'],
        'img': ['src', 'srcset', 'alt', 'title', 'width', 'height', 'style', 'class'],
        'span': ['style', 'class'],
        'p': ['style', 'class'],
        'li': ['class'],
        'ol': ['class', 'start', 'type'],
        'ul': ['class'],
        'pre': ['class', 'spellcheck'], // spellcheck="false" is common for code blocks
        'code': ['class'],
        'blockquote': ['class'],
        // '*': ['class', 'id'] // Allow class/id on any tag - be cautious with 'id'
        '*': ['class'] // More common to allow class on any tag
    },
    allowedStyles: {
        '*': {
            'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i, /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i, /^[a-z]+$/i],
            'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i, /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i],
            'font-size': [/^\d+(?:px|em|rem|pt|%|vw|vh)$/],
            'font-family': [/^[a-z0-9\s,'"'-_]+$/i], // Allow more characters for font names
            'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
            'font-weight': true, 'font-style': true, 'text-decoration': true, 'text-decoration-line': true,
            'line-height': [/^\d*\.?\d+(?:px|em|rem|%|)$/], // Allow unitless line-height
            'margin': [/^\d+(?:px|em|rem|pt|%)(?:\s+\d+(?:px|em|rem|pt|%))?(?:\s+\d+(?:px|em|rem|pt|%))?(?:\s+\d+(?:px|em|rem|pt|%))?$/, /^auto$/i],
            'padding': [/^\d+(?:px|em|rem|pt|%)(?:\s+\d+(?:px|em|rem|pt|%))?(?:\s+\d+(?:px|em|rem|pt|%))?(?:\s+\d+(?:px|em|rem|pt|%))?$/],
            'width': [/^\d+(?:px|%|vw)$/, /^auto$/i],
            'height': [/^\d+(?:px|%|vh)$/, /^auto$/i],
            // Add other safe style properties you expect from Quill
        }
    },
    allowedClasses: { // Allow classes that Quill uses for formatting
        // This is highly dependent on your Quill setup and themes. Inspect Quill's output.
        'p': ['ql-align-center', 'ql-align-right', 'ql-align-justify', 'ql-direction-rtl'],
        'span': [/^ql-font-\w+$/, /^ql-size-\w+$/, 'ql-formula', 'ql-cursor', /^katex/], // for KaTeX and Quill fonts/sizes
        'pre': ['ql-syntax', /^language-\w+$/], // for code blocks
        'li': ['ql-indent-*'], // for indented lists
        // '*': [/^ql-/] // Allow all ql- prefixed classes if you trust Quill's output structure
    },
    transformTags: {
        'b': 'strong',
        'i': 'em',
    },
    allowComments: false,
    allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
    // For images, ensure 'data' URI scheme is allowed if Quill embeds small images as base64
    // allowedSchemesByTag: { 'img': ['data', 'http', 'https'] }
};

// 示例：公告栏的更严格配置
const announcementSanitizeOptions = {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'span'],
    allowedAttributes: {
        'a': ['href', 'target', 'rel'],
        'span': ['style']
    },
    allowedStyles: {
        'span': {
            'color': defaultSanitizeOptions.allowedStyles['*']['color'],
            'background-color': defaultSanitizeOptions.allowedStyles['*']['background-color'],
            'font-weight': true, 'font-style': true, 'text-decoration': true,
        }
    },
    transformTags: { 'b': 'strong', 'i': 'em' },
    allowComments: false,
};

/**
 * Cleans HTML content based on the specified type.
 * @param {string} htmlContent - The HTML string to sanitize.
 * @param {'default' | 'announcement' | string} [type='default'] - The type of content, determines which sanitization rules to use.
 * @returns {string} The sanitized HTML string.
 */
export function sanitizeBlogContent(htmlContent, type = 'default') {
    if (typeof htmlContent !== 'string') return ''; // Or throw an error

    let options;
    switch (type) {
        case 'announcement':
            options = announcementSanitizeOptions;
            break;
        // Add more cases for 'comment', 'news_article' if they need different rules
        case 'default':
        default:
            options = defaultSanitizeOptions;
            break;
    }
    return sanitizeHtml(htmlContent, options);
}