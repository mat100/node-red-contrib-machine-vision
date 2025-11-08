/**
 * Shared utilities for Machine Vision Flow Node-RED nodes
 *
 * This module provides common functions to eliminate code duplication across
 * vision processing nodes and ensure consistent behavior.
 */

const axios = require('axios');

/**
 * Status configuration constants
 */
const STATUS = {
    READY: { fill: "grey", shape: "ring", text: "ready" },
    PROCESSING: { fill: "blue", shape: "dot", text: "processing..." },
    ERROR: { fill: "red", shape: "dot" },
    SUCCESS: { fill: "green", shape: "dot" },
    NO_RESULTS: { fill: "yellow", shape: "ring" }
};

/**
 * Set node status with consistent formatting
 *
 * @param {object} node - Node-RED node instance
 * @param {string} statusType - Status type: 'ready', 'processing', 'error', 'success', 'no_results'
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
            status.text = message || "error";
            break;
        case 'success':
            status = { ...STATUS.SUCCESS };
            if (processingTime !== null) {
                status.text = message ? `${message} | ${processingTime}ms` : `${processingTime}ms`;
            } else {
                status.text = message || "success";
            }
            break;
        case 'no_results':
            status = { ...STATUS.NO_RESULTS };
            if (processingTime !== null) {
                status.text = message ? `${message} | ${processingTime}ms` : `no results | ${processingTime}ms`;
            } else {
                status.text = message || "no results";
            }
            break;
        default:
            status = { fill: "grey", shape: "ring", text: message || "unknown" };
    }

    node.status(status);
}

/**
 * Create standardized VisionObject message payload
 *
 * Eliminates the duplicated message mapping pattern found across all vision nodes.
 *
 * @param {object} obj - Vision object from API response
 * @param {string} imageId - Image ID reference
 * @param {string} timestamp - ISO timestamp
 * @param {string} thumbnail - Base64 thumbnail
 * @param {object} msg - Original message (for cloning)
 * @param {object} RED - Node-RED instance
 * @returns {object} Cloned message with VisionObject in payload
 */
function createVisionObjectMessage(obj, imageId, timestamp, thumbnail, msg, RED) {
    const outputMsg = RED.util.cloneMessage(msg);

    // Build standardized VisionObject in payload
    outputMsg.payload = {
        object_id: obj.object_id,
        object_type: obj.object_type,
        image_id: imageId,
        timestamp: timestamp,
        bounding_box: obj.bounding_box,
        center: obj.center,
        confidence: obj.confidence,
        thumbnail: thumbnail,
        properties: obj.properties || {}
    };

    // Add optional fields if present
    if (obj.area !== undefined && obj.area !== null) {
        outputMsg.payload.area = obj.area;
    }
    if (obj.perimeter !== undefined && obj.perimeter !== null) {
        outputMsg.payload.perimeter = obj.perimeter;
    }
    if (obj.rotation !== undefined && obj.rotation !== null) {
        outputMsg.payload.rotation = obj.rotation;
    }
    if (obj.contour !== undefined && obj.contour !== null) {
        outputMsg.payload.contour = obj.contour;
    }

    return outputMsg;
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

    // Validate config node
    if (!apiConfig) {
        const errorMessage = 'Missing API configuration. Please configure mv-config node.';
        setNodeStatus(node, 'error', 'no config');
        node.error(errorMessage);
        if (done) {
            done(new Error(errorMessage));
        }
        throw new Error(errorMessage);
    }

    // Extract configuration from config node
    const apiUrl = apiConfig.apiUrl || 'http://localhost:8000';
    const timeout = apiConfig.timeout || 30000;
    const url = `${apiUrl}${endpoint}`;

    // Build headers
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
            const detail = error.response.data?.detail || error.response.statusText;

            if (status === 404) {
                errorMessage = `Not found: ${detail}`;
                statusMessage = "not found";
            } else if (status === 400) {
                errorMessage = `Invalid request: ${detail}`;
                statusMessage = "invalid request";
            } else if (status === 401 || status === 403) {
                errorMessage = `Authentication error: ${detail}`;
                statusMessage = "auth error";
            } else if (status >= 500) {
                errorMessage = `Server error: ${detail}`;
                statusMessage = "server error";
            } else {
                errorMessage = `API error (${status}): ${detail}`;
                statusMessage = `error ${status}`;
            }
        } else if (error.request) {
            // Network error - no response received
            errorMessage = `Network error: Cannot reach API at ${url}`;
            statusMessage = "network error";
        } else if (error.code === 'ECONNABORTED') {
            // Timeout
            errorMessage = `Timeout: Request took longer than ${timeout}ms`;
            statusMessage = "timeout";
        } else {
            // Other error
            errorMessage = `Error: ${error.message}`;
            statusMessage = "error";
        }

        // Update node status and log error
        setNodeStatus(node, 'error', statusMessage);
        node.error(errorMessage);

        // Call done with error
        if (done) {
            done(new Error(errorMessage));
        }

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
 * Supports multiple common locations
 *
 * @param {object} msg - Message object
 * @returns {string|null} Image ID or null if not found
 */
function getImageId(msg) {
    return msg.image_id || msg.payload?.image_id || null;
}

/**
 * Extract timestamp from message or create new one
 *
 * @param {object} msg - Message object
 * @returns {string} ISO timestamp
 */
function getTimestamp(msg) {
    return msg.payload?.timestamp || new Date().toISOString();
}

module.exports = {
    setNodeStatus,
    createVisionObjectMessage,
    callVisionAPI,
    validateRequiredFields,
    getImageId,
    getTimestamp,
    STATUS
};
