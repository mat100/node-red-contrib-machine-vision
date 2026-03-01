/**
 * Shared utilities for Machine Vision Flow Node-RED nodes
 *
 * This module provides common functions to eliminate code duplication across
 * vision processing nodes and ensure consistent behavior.
 */

const axios = require('axios');
const CONSTANTS = require('./constants');

/**
 * @typedef {Object} VisionObjectMessage
 * @description Standardized Node-RED message produced by all vision nodes.
 * Fixed structure — all fields always present (null when not applicable).
 *
 * @property {string|null} topic - Message topic (e.g., 'mv/camera/test')
 * @property {Object|null} image - Image metadata
 * @property {string} image.id - Image identifier
 * @property {string} image.format - Image format (jpeg, png, bmp)
 * @property {number} image.width - Image width in pixels
 * @property {number} image.height - Image height in pixels
 * @property {string} image.source - Image source (camera, file, test, preprocess)
 * @property {string} image.timestamp - ISO 8601 timestamp
 * @property {Object} payload - VisionObject payload (all fields always present)
 * @property {string} payload.object_id - Unique identifier for the detected object
 * @property {string} payload.object_type - Type of detection
 * @property {Object|null} payload.roi - Input ROI (null if full image)
 * @property {number} payload.confidence - Detection confidence (0-1)
 * @property {string} payload.coords - Coordinate system ('image' or 'roi')
 * @property {Object} payload.bbox - Bounding box {x, y, width, height}
 * @property {Object} payload.center - Center point {x, y}
 * @property {number|null} payload.angle - Rotation angle in degrees
 * @property {Object|null} payload.real - Real-world coordinates {center, bbox, angle}
 * @property {Array|null} payload.contour - Contour points array
 * @property {number|null} payload.area - Object area in pixels
 * @property {number|null} payload.perimeter - Object perimeter in pixels
 * @property {Object} payload.metadata - Detection-specific metadata
 * @property {Object|null} reference - Reference coordinate system (set by aruco-reference node)
 * @property {boolean} success - Whether the detection succeeded
 * @property {number} processing_time_ms - Backend processing time in milliseconds
 * @property {string|null} thumbnail - Base64-encoded thumbnail image
 */

/**
 * Status configuration constants
 */
const STATUS = {
    READY: { fill: 'grey', shape: 'ring', text: 'ready' },
    PROCESSING: { fill: 'blue', shape: 'dot', text: 'processing...' },
    ERROR: { fill: 'red', shape: 'dot' },
    SUCCESS: { fill: 'green', shape: 'dot' },
    NO_RESULTS: { fill: 'yellow', shape: 'ring' }
};

/**
 * Extract API settings from config node
 *
 * Provides centralized configuration extraction for all nodes.
 * This eliminates the duplicated getApiSettings() pattern found in
 * camera and image nodes.
 *
 * @param {object} apiConfig - MV config node instance
 * @returns {object} Object with apiUrl, timeout, and headers
 * @throws {Error} If apiConfig is not provided
 */
function getApiSettings(apiConfig) {
    if (!apiConfig) {
        throw new Error('Missing API configuration. Please configure mv-config node.');
    }

    const apiUrl = apiConfig.apiUrl || CONSTANTS.API.DEFAULT_URL;
    const timeout = apiConfig.timeout || CONSTANTS.API.DEFAULT_TIMEOUT;

    const headers = {
        'Content-Type': 'application/json'
    };

    // Add credentials if configured
    if (apiConfig.credentials) {
        if (apiConfig.credentials.apiKey) {
            headers['X-API-Key'] = apiConfig.credentials.apiKey;
        }
        if (apiConfig.credentials.apiToken) {
            headers['Authorization'] = `Bearer ${apiConfig.credentials.apiToken}`;
        }
    }

    return { apiUrl, timeout, headers };
}

/**
 * Set node status with consistent formatting
 *
 * @param {object} node - Node-RED node instance
 * @param {string} statusType - Status type: 'ready', 'processing', 'error', 'success', 'no_results', 'clear'
 * @param {string} message - Optional status message
 * @param {number} processingTime - Optional processing time in ms
 */
function setNodeStatus(node, statusType, message = null, processingTime = null) {
    let status;

    switch (statusType) {
    case 'ready':
        status = { ...STATUS.READY };
        break;
    case 'processing':
        status = { ...STATUS.PROCESSING };
        if (message) status.text = message;
        break;
    case 'error':
        status = { ...STATUS.ERROR };
        status.text = message || 'error';
        break;
    case 'success':
        status = { ...STATUS.SUCCESS };
        if (processingTime !== null) {
            status.text = message ? `${message} | ${processingTime}ms` : `${processingTime}ms`;
        } else {
            status.text = message || 'success';
        }
        break;
    case 'no_results':
        status = { ...STATUS.NO_RESULTS };
        if (processingTime !== null) {
            status.text = message ? `${message} | ${processingTime}ms` : `no results | ${processingTime}ms`;
        } else {
            status.text = message || 'no results';
        }
        break;
    case 'clear':
        status = {};
        break;
    default:
        status = { fill: 'grey', shape: 'ring', text: message || 'unknown' };
    }

    node.status(status);
}

/**
 * Create standardized VisionObject message payload
 *
 * Fixed structure — all fields always present (null when not applicable).
 * Backend returns complete objects with null values, so we map them 1:1.
 *
 * @param {object} obj - Vision object from API response
 * @param {object|null} imageInfo - ImageInfo object {id, format, width, height, source, timestamp}
 * @param {string|null} thumbnail - Base64 thumbnail
 * @param {object} msg - Original message (for cloning)
 * @param {object} RED - Node-RED instance
 * @returns {object} Cloned message with VisionObject in payload
 */
function createVisionObjectMessage(obj, imageInfo, thumbnail, msg, RED) {
    const outputMsg = RED.util.cloneMessage(msg);

    // Payload: fixed structure — all fields always present
    outputMsg.payload = {
        object_id: obj.object_id,
        object_type: obj.object_type,
        roi: obj.roi || null,
        confidence: obj.confidence,
        coords: obj.coords || 'image',
        bbox: obj.bbox,
        center: obj.center,
        angle: obj.angle || null,
        real: obj.real || null,
        contour: obj.contour || null,
        area: obj.area || null,
        perimeter: obj.perimeter || null,
        metadata: obj.metadata || {}
    };

    // Root-level: fixed structure
    outputMsg.image = imageInfo || null;
    outputMsg.thumbnail = thumbnail || null;
    // msg.topic and msg.reference are preserved via cloneMessage()

    return outputMsg;
}

/**
 * Add standard metadata to an output message
 *
 * Sets success, processing_time_ms, and ensures reference/topic are present.
 *
 * @param {Object} outputMsg - The output message to annotate
 * @param {Object} node - Node-RED node instance
 * @param {Object} result - API response containing processing_time_ms
 */
function addMessageMetadata(outputMsg, node, result) {
    outputMsg.success = true;
    outputMsg.processing_time_ms = result.processing_time_ms;
    // reference: preserve from input msg (via cloneMessage), or null
    if (outputMsg.reference === undefined) {
        outputMsg.reference = null;
    }
    // topic: preserve from input msg (via cloneMessage), or null
    if (outputMsg.topic === undefined) {
        outputMsg.topic = null;
    }
}

/**
 * Call vision API with consistent error handling
 *
 * Wraps axios calls with standardized error handling, timeout management,
 * and status updates.
 *
 * @param {object} options - API call options
 * @param {object} options.node - Node-RED node instance
 * @param {string} options.endpoint - API endpoint path (e.g., '/api/vision/edge-detect')
 * @param {object} options.requestData - Request payload
 * @param {object} options.apiConfig - MV config node instance (required)
 * @param {function} options.done - Node-RED done callback
 * @returns {Promise<object>} API response data
 * @throws {Error} Network or API error
 */
async function callVisionAPI(options) {
    const {
        node,
        endpoint,
        requestData,
        apiConfig,
        done
    } = options;

    // Extract API settings (validates config node)
    let apiUrl, timeout, headers;
    try {
        ({ apiUrl, timeout, headers } = getApiSettings(apiConfig));
    } catch (error) {
        setNodeStatus(node, 'error', 'no config');
        node.error(error.message);
        if (done) {
            done(error);
        }
        throw error;
    }

    const url = `${apiUrl}${endpoint}`;

    try {
        setNodeStatus(node, 'processing');

        const response = await axios.post(url, requestData, {
            timeout: timeout,
            headers: headers
        });

        return response.data;

    } catch (error) {
        // Distinguish between different error types
        let errorMessage;
        let statusMessage;

        if (error.response) {
            // API returned error response (4xx, 5xx)
            const status = error.response.status;
            const rawDetail = error.response.data?.detail;
            // detail can be a string or object (from @safe_endpoint's HTTPException)
            // Extract human-readable message from structured error responses
            const detail = (typeof rawDetail === 'object' && rawDetail !== null)
                ? (rawDetail.details || rawDetail.error || JSON.stringify(rawDetail))
                : (rawDetail || error.response.statusText);

            if (status === 404) {
                errorMessage = `Not found: ${detail}`;
                statusMessage = 'not found';
            } else if (status === 400) {
                errorMessage = `Invalid request: ${detail}`;
                statusMessage = 'invalid request';
            } else if (status === 401 || status === 403) {
                errorMessage = `Authentication error: ${detail}`;
                statusMessage = 'auth error';
            } else if (status >= 500) {
                errorMessage = `Server error: ${detail}`;
                statusMessage = 'server error';
            } else {
                errorMessage = `API error (${status}): ${detail}`;
                statusMessage = `error ${status}`;
            }
        } else if (error.request) {
            // Network error - no response received
            errorMessage = `Network error: Cannot reach API at ${url}`;
            statusMessage = 'network error';
        } else if (error.code === 'ECONNABORTED') {
            // Timeout
            errorMessage = `Timeout: Request took longer than ${timeout}ms`;
            statusMessage = 'timeout';
        } else {
            // Other error
            errorMessage = `Error: ${error.message}`;
            statusMessage = 'error';
        }

        // Update node status and log error
        setNodeStatus(node, 'error', statusMessage);
        node.error(errorMessage);

        // Call done with error
        if (done) {
            done(new Error(errorMessage));
        }

        // Mark error as handled so nodes don't double-call done()
        error.handledByUtils = true;

        throw error;
    }
}

/**
 * Validate required message fields
 *
 * @param {object} msg - Message object
 * @param {Array<string>} requiredFields - Array of required field paths (e.g., ['image_id', 'payload.contour'])
 * @param {object} node - Node-RED node instance
 * @param {function} done - Node-RED done callback
 * @returns {boolean} True if all fields present, false otherwise
 */
function validateRequiredFields(msg, requiredFields, node, done) {
    for (const fieldPath of requiredFields) {
        const parts = fieldPath.split('.');
        let value = msg;

        for (const part of parts) {
            value = value?.[part];
        }

        if (value === undefined || value === null) {
            const errorMsg = `Missing required field: ${fieldPath}`;
            node.error(errorMsg, msg);
            setNodeStatus(node, 'error', `missing ${fieldPath}`);
            if (done) {
                done(new Error(errorMsg));
            }
            return false;
        }
    }

    return true;
}

/**
 * Extract image_id from message
 *
 * Canonical location is msg.image.id (set by all source nodes and preprocess).
 *
 * @param {object} msg - Message object
 * @returns {string|null} Image ID or null if not found
 */
function getImageId(msg) {
    return msg.image?.id || null;
}

/**
 * Extract timestamp from message or create new one
 *
 * @param {object} msg - Message object
 * @returns {string} ISO timestamp
 */
function getTimestamp(msg) {
    return msg.image?.timestamp || new Date().toISOString();
}

/**
 * Call camera API with consistent error handling
 *
 * Wrapper for camera-related API calls (connect, capture, disconnect, etc.)
 *
 * @param {object} options - API call options
 * @param {object} options.node - Node-RED node instance
 * @param {string} options.endpoint - API endpoint path (e.g., '/api/camera/connect')
 * @param {object} options.requestData - Request payload (can be null)
 * @param {object} options.params - Optional URL query parameters
 * @param {object} options.apiConfig - MV config node instance
 * @param {function} options.done - Node-RED done callback (optional)
 * @param {string} options.method - HTTP method (default: 'POST')
 * @returns {Promise<object>} API response data
 * @throws {Error} Network or API error
 */
async function callCameraAPI(options) {
    const {
        node,
        endpoint,
        requestData = null,
        params = null,
        apiConfig,
        done = null,
        method = 'POST'
    } = options;

    // Extract API settings
    let apiUrl, timeout, headers;
    try {
        ({ apiUrl, timeout, headers } = getApiSettings(apiConfig));
    } catch (error) {
        if (node) {
            setNodeStatus(node, 'error', CONSTANTS.STATUS_TEXT.NO_CONFIG);
            node.error(error.message);
        }
        if (done) done(error);
        throw error;
    }

    const url = `${apiUrl}${endpoint}`;

    try {
        const config = {
            timeout: timeout,
            headers: headers
        };

        if (params) {
            config.params = params;
        }

        let response;
        if (method === 'GET') {
            response = await axios.get(url, config);
        } else {
            response = await axios.post(url, requestData, config);
        }

        return response.data;

    } catch (error) {
        // Enhanced error handling
        const errorMessage = extractErrorMessage(error, url, timeout);

        if (node) {
            const statusMessage = getStatusMessage(error);
            setNodeStatus(node, 'error', statusMessage);
            node.error(errorMessage);
        }

        if (done) {
            done(new Error(errorMessage));
        }

        // Mark error as handled so nodes don't double-call done()
        error.handledByUtils = true;

        throw error;
    }
}

/**
 * Call image API with consistent error handling
 *
 * Wrapper for image-related API calls (import, extract-roi, etc.)
 *
 * @param {object} options - API call options
 * @param {object} options.node - Node-RED node instance
 * @param {string} options.endpoint - API endpoint path (e.g., '/api/image/import')
 * @param {object} options.requestData - Request payload
 * @param {object} options.apiConfig - MV config node instance
 * @param {function} options.done - Node-RED done callback (optional)
 * @returns {Promise<object>} API response data
 * @throws {Error} Network or API error
 */
async function callImageAPI(options) {
    const {
        node,
        endpoint,
        requestData,
        apiConfig,
        done = null
    } = options;

    // Extract API settings
    let apiUrl, timeout, headers;
    try {
        ({ apiUrl, timeout, headers } = getApiSettings(apiConfig));
    } catch (error) {
        if (node) {
            setNodeStatus(node, 'error', CONSTANTS.STATUS_TEXT.NO_CONFIG);
            node.error(error.message);
        }
        if (done) done(error);
        throw error;
    }

    const url = `${apiUrl}${endpoint}`;

    try {
        const response = await axios.post(url, requestData, {
            timeout: timeout,
            headers: headers
        });

        return response.data;

    } catch (error) {
        // Enhanced error handling
        const errorMessage = extractErrorMessage(error, url, timeout);

        if (node) {
            const statusMessage = getStatusMessage(error);
            setNodeStatus(node, 'error', statusMessage);
            node.error(errorMessage);
        }

        if (done) {
            done(new Error(errorMessage));
        }

        // Mark error as handled so nodes don't double-call done()
        error.handledByUtils = true;

        throw error;
    }
}

/**
 * Extract error message from axios error
 *
 * @param {Error} error - Axios error object
 * @param {string} url - Request URL
 * @param {number} timeout - Timeout value
 * @returns {string} Error message
 */
function extractErrorMessage(error, url, timeout) {
    if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail || error.response.statusText;

        if (status === 404) return `Not found: ${detail}`;
        if (status === 400) return `Invalid request: ${detail}`;
        if (status === 401 || status === 403) return `Authentication error: ${detail}`;
        if (status >= 500) return `Server error: ${detail}`;
        return `API error (${status}): ${detail}`;
    }

    if (error.request) {
        return `Network error: Cannot reach API at ${url}`;
    }

    if (error.code === 'ECONNABORTED') {
        return `Timeout: Request took longer than ${timeout}ms`;
    }

    return `Error: ${error.message}`;
}

/**
 * Get status message from error
 *
 * @param {Error} error - Axios error object
 * @returns {string} Status message
 */
function getStatusMessage(error) {
    if (error.response) {
        const status = error.response.status;
        if (status === 404) return CONSTANTS.STATUS_TEXT.NOT_FOUND;
        if (status === 400) return CONSTANTS.STATUS_TEXT.INVALID_REQUEST;
        if (status === 401 || status === 403) return CONSTANTS.STATUS_TEXT.AUTH_ERROR;
        if (status >= 500) return CONSTANTS.STATUS_TEXT.SERVER_ERROR;
        return `error ${status}`;
    }

    if (error.request) {
        return CONSTANTS.STATUS_TEXT.NETWORK_ERROR;
    }

    if (error.code === 'ECONNABORTED') {
        return CONSTANTS.STATUS_TEXT.TIMEOUT;
    }

    return CONSTANTS.STATUS_TEXT.ERROR;
}

/**
 * Input Validation Utilities
 */

/**
 * Validate ROI coordinates
 *
 * @param {object} roi - ROI object with x, y, width, height
 * @param {object} options - Optional validation options
 * @param {number} options.maxWidth - Maximum allowed width
 * @param {number} options.maxHeight - Maximum allowed height
 * @returns {object} Validation result with valid boolean and error message
 */
function validateROI(roi, options = {}) {
    if (!roi || typeof roi !== 'object') {
        return { valid: false, error: 'ROI must be an object' };
    }

    const { x, y, width, height } = roi;

    // Check if all required fields are present
    if (x === undefined || y === undefined || width === undefined || height === undefined) {
        return { valid: false, error: 'ROI must have x, y, width, and height properties' };
    }

    // Validate types
    if (typeof x !== 'number' || typeof y !== 'number' ||
        typeof width !== 'number' || typeof height !== 'number') {
        return { valid: false, error: 'ROI coordinates must be numbers' };
    }

    // Validate x and y (must be non-negative)
    if (x < 0 || y < 0) {
        return { valid: false, error: 'ROI x and y must be non-negative' };
    }

    // Validate width and height (must be positive)
    if (width <= 0 || height <= 0) {
        return { valid: false, error: 'ROI width and height must be positive' };
    }

    // Check against max dimensions if provided
    if (options.maxWidth && width > options.maxWidth) {
        return { valid: false, error: `ROI width exceeds maximum (${options.maxWidth})` };
    }

    if (options.maxHeight && height > options.maxHeight) {
        return { valid: false, error: `ROI height exceeds maximum (${options.maxHeight})` };
    }

    return { valid: true };
}

/**
 * Validate and sanitize image ID
 *
 * Prevents path traversal attacks and ensures valid format
 *
 * @param {string} imageId - Image ID to validate
 * @returns {object} Validation result with valid boolean and sanitized ID or error
 */
function validateImageId(imageId) {
    if (!imageId || typeof imageId !== 'string') {
        return { valid: false, error: 'Image ID must be a non-empty string' };
    }

    // Check for path traversal attempts
    if (imageId.includes('..') || imageId.includes('/') || imageId.includes('\\')) {
        return { valid: false, error: 'Image ID contains invalid characters (path traversal attempt)' };
    }

    // Check for valid format (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(imageId)) {
        return { valid: false, error: 'Image ID must contain only alphanumeric characters, hyphens, and underscores' };
    }

    // Check length (reasonable limits)
    if (imageId.length < 1 || imageId.length > 255) {
        return { valid: false, error: 'Image ID must be between 1 and 255 characters' };
    }

    return { valid: true, sanitized: imageId };
}

/**
 * Validate numeric value within range
 *
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} fieldName - Name of field for error messages
 * @returns {object} Validation result with valid boolean and error message
 */
function validateNumericRange(value, min, max, fieldName = 'value') {
    if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: `${fieldName} must be a valid number` };
    }

    if (value < min || value > max) {
        return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
    }

    return { valid: true };
}

/**
 * Validate threshold value (0-1 range)
 *
 * @param {number} threshold - Threshold value to validate
 * @returns {object} Validation result with valid boolean and error message
 */
function validateThreshold(threshold) {
    return validateNumericRange(threshold, 0, 1, 'threshold');
}

/**
 * Security Utilities
 */

/**
 * Sanitize error message for production
 *
 * Removes sensitive information from error messages in production mode
 *
 * @param {string} errorMessage - Original error message
 * @param {boolean} isDevelopment - Whether in development mode
 * @returns {string} Sanitized error message
 */
function sanitizeErrorForProduction(errorMessage, isDevelopment = process.env.NODE_ENV === 'development') {
    if (isDevelopment) {
        return errorMessage;
    }

    // In production, return generic messages for security
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Network error')) {
        return 'Unable to connect to backend service';
    }

    if (errorMessage.includes('Authentication error') || errorMessage.includes('401') || errorMessage.includes('403')) {
        return 'Authentication failed';
    }

    if (errorMessage.includes('Not found') || errorMessage.includes('404')) {
        return 'Requested resource not found';
    }

    if (errorMessage.includes('Server error') || errorMessage.includes('500')) {
        return 'Internal server error occurred';
    }

    // Generic fallback
    return 'An error occurred. Check logs for details.';
}

/**
 * Logging Utilities
 */

/**
 * Structured debug logging
 *
 * Logs debug information when MV_DEBUG environment variable is set
 *
 * @param {object} node - Node-RED node instance
 * @param {string} category - Log category (e.g., 'api', 'validation', 'processing')
 * @param {string} message - Log message
 * @param {object} data - Additional data to log
 */
function debugLog(node, category, message, data = {}) {
    if (process.env.MV_DEBUG === 'true') {
        const logEntry = {
            timestamp: new Date().toISOString(),
            category: category,
            message: message,
            node: node?.name || node?.type || 'unknown',
            data: data
        };

        if (node && node.log) {
            node.log(JSON.stringify(logEntry));
        } else {
            console.log('[MV_DEBUG]', JSON.stringify(logEntry));
        }
    }
}

/**
 * Rate limiting utility
 *
 * Simple rate limiter to prevent overwhelming the backend
 *
 * @param {string} key - Unique key for rate limiting (e.g., node ID)
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} True if request is allowed, false if rate limited
 */
const rateLimiters = new Map();

function checkRateLimit(key, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();

    if (!rateLimiters.has(key)) {
        rateLimiters.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    const limiter = rateLimiters.get(key);

    // Reset if window expired
    if (now >= limiter.resetAt) {
        limiter.count = 1;
        limiter.resetAt = now + windowMs;
        return true;
    }

    // Check if limit exceeded
    if (limiter.count >= maxRequests) {
        return false;
    }

    limiter.count++;
    return true;
}

/**
 * Clear rate limiter for a specific key
 *
 * @param {string} key - Rate limiter key to clear
 */
function clearRateLimit(key) {
    rateLimiters.delete(key);
}

/**
 * Validate input message has image_id and return it
 *
 * Replaces the 5-line validation pattern duplicated across 9 vision nodes.
 *
 * @param {object} node - Node-RED node instance
 * @param {object} msg - Input message
 * @param {function} done - Node-RED done callback
 * @returns {object} { valid: true, imageId } or { valid: false }
 */
function validateInput(node, msg, done) {
    const imageId = getImageId(msg);
    if (!imageId) {
        node.error('No image.id provided', msg);
        setNodeStatus(node, 'error', 'missing image.id');
        done(new Error('No image.id provided'));
        return { valid: false };
    }
    return { valid: true, imageId };
}

/**
 * File Upload Helper
 */

/**
 * Handle file upload from Node-RED editor to backend API
 *
 * Encapsulates: file validation → FormData → axios POST → temp cleanup → error handling.
 *
 * @param {object} req - Express request (with multer-parsed req.file)
 * @param {object} res - Express response
 * @param {object} options - Upload options
 * @param {string} options.backendEndpoint - Backend API path (e.g., '/api/test-image/upload')
 * @param {object} options.apiConfig - MV config node instance
 * @param {object} [options.additionalFormFields={}] - Extra fields to append to FormData
 * @param {function} [options.transformResponse] - Transform response.data before sending to client
 */
async function handleFileUpload(req, res, options) {
    const {
        backendEndpoint,
        apiConfig,
        additionalFormFields = {},
        transformResponse
    } = options;

    const FormData = require('form-data');
    const fs = require('fs');

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.file;
        const { apiUrl, headers } = getApiSettings(apiConfig);

        // Build multipart form data
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path), {
            filename: file.originalname,
            contentType: file.mimetype
        });

        for (const [key, value] of Object.entries(additionalFormFields)) {
            formData.append(key, value);
        }

        // POST to backend
        const response = await axios.post(
            `${apiUrl}${backendEndpoint}`,
            formData,
            {
                headers: {
                    ...headers,
                    ...formData.getHeaders()
                }
            }
        );

        // Clean up temp file
        try {
            fs.unlinkSync(file.path);
        } catch (_e) {
            // Ignore cleanup errors
        }

        // Transform and send response
        const result = transformResponse
            ? transformResponse(response.data, file)
            : response.data;

        res.json(result);

    } catch (error) {
        // Clean up temp file on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (_e) {
                // Ignore cleanup errors
            }
        }

        const errorMsg = error.response?.data?.detail || error.message || 'Upload failed';
        res.status(500).json({
            error: errorMsg,
            details: error.response ? error.response.data : null
        });
    }
}

/**
 * Parameter Builders
 */

/**
 * Edge Detection Parameter Builder
 *
 * Builds edge detection parameters with defaults from constants
 *
 * @param {object} config - Node configuration
 * @param {string} config.method - Edge detection method
 * @param {number} config.cannyLow - Canny low threshold
 * @param {number} config.cannyHigh - Canny high threshold
 * @param {number} config.sobelThreshold - Sobel threshold
 * @param {number} config.laplacianThreshold - Laplacian threshold
 * @param {number} config.minContourArea - Minimum contour area
 * @param {number} config.maxContourArea - Maximum contour area
 * @param {number} config.maxContours - Maximum contours
 * @param {boolean} config.blurEnabled - Enable blur preprocessing
 * @param {number} config.blurKernel - Blur kernel size
 * @param {boolean} config.bilateralEnabled - Enable bilateral filter
 * @param {boolean} config.morphologyEnabled - Enable morphology
 * @param {string} config.morphologyOperation - Morphology operation
 * @returns {object} Edge detection parameters
 */
function buildEdgeDetectParams(config) {
    const defaults = CONSTANTS.EDGE_DETECT;

    return {
        // Method selection
        method: config.method || 'canny',

        // Canny parameters
        canny_low: parseInt(config.cannyLow) || defaults.CANNY_LOW_THRESHOLD,
        canny_high: parseInt(config.cannyHigh) || defaults.CANNY_HIGH_THRESHOLD,

        // Sobel parameters
        sobel_threshold: parseInt(config.sobelThreshold) || defaults.SOBEL_THRESHOLD,
        sobel_kernel: defaults.SOBEL_KSIZE,

        // Laplacian parameters
        laplacian_threshold: parseInt(config.laplacianThreshold) || defaults.LAPLACIAN_THRESHOLD,
        laplacian_kernel: defaults.LAPLACIAN_KSIZE,

        // Prewitt parameters
        prewitt_threshold: defaults.PREWITT_THRESHOLD,

        // Scharr parameters
        scharr_threshold: defaults.SCHARR_THRESHOLD,

        // Morphological gradient parameters
        morph_threshold: defaults.MORPH_THRESHOLD,
        morph_kernel: defaults.MORPH_KERNEL,

        // Contour filtering parameters
        min_contour_area: parseInt(config.minContourArea) || CONSTANTS.LIMITS.MIN_CONTOUR_AREA,
        max_contour_area: parseInt(config.maxContourArea) || CONSTANTS.LIMITS.MAX_CONTOUR_AREA,
        min_contour_perimeter: 0,
        max_contour_perimeter: 999999,
        max_contours: parseInt(config.maxContours) || CONSTANTS.LIMITS.MAX_CONTOURS,
        show_centers: true
    };
}

module.exports = {
    // API and Configuration
    getApiSettings,

    // Status Management
    setNodeStatus,
    STATUS,

    // Message Building
    createVisionObjectMessage,
    addMessageMetadata,

    // API Wrappers
    callVisionAPI,
    callCameraAPI,
    callImageAPI,

    // Field Validation
    validateRequiredFields,
    getImageId,
    getTimestamp,

    // Input Validation
    validateROI,
    validateImageId,
    validateNumericRange,
    validateThreshold,

    // Security
    sanitizeErrorForProduction,

    // Logging and Debugging
    debugLog,

    // Rate Limiting
    checkRateLimit,
    clearRateLimit,

    // Input Validation Shortcut
    validateInput,

    // File Upload
    handleFileUpload,

    // Parameter Builders
    buildEdgeDetectParams,

    // Constants
    CONSTANTS
};
