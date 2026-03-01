module.exports = function(RED) {
    const axios = require('axios');
    const visionUtils = require('../lib/vision-utils');

    function MVCameraCaptureNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.sourceType = config.sourceType || 'usb';

        // Determine camera ID based on source type
        if (node.sourceType === 'test') {
            // Test mode - always use 'test' camera
            node.cameraId = 'test';
        } else if (node.sourceType === 'ip' && config.ipCameraUrl) {
            // Format IP camera URL as ip_{url}
            node.cameraId = `ip_${config.ipCameraUrl}`;
        } else {
            // Use configured camera ID (USB or test)
            node.cameraId = config.cameraId || 'test';
        }

        node.autoConnect = config.autoConnect || false;

        // Status
        visionUtils.setNodeStatus(node, 'ready');

        // Connect to camera on startup if autoConnect (skip for test mode)
        if (node.autoConnect && node.cameraId && node.sourceType !== 'test') {
            // Wait for backend to be ready, then connect
            connectCameraWithRetry();
        }

        // Connect to camera with retry logic
        async function connectCameraWithRetry(maxRetries = visionUtils.CONSTANTS.RETRY.MAX_ATTEMPTS, retryDelay = visionUtils.CONSTANTS.RETRY.DELAY_MS) {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Check if backend is available
                    await visionUtils.callCameraAPI({
                        node: null, // No node for health check
                        endpoint: '/api/system/health',
                        method: 'GET',
                        apiConfig: node.apiConfig
                    });

                    // Backend is ready, try to connect camera
                    visionUtils.setNodeStatus(node, 'processing', `connecting (${attempt}/${maxRetries})...`);

                    const result = await visionUtils.callCameraAPI({
                        node: null, // Handle status manually
                        endpoint: '/api/camera/connect',
                        requestData: {
                            camera_id: node.cameraId,
                            resolution: config.resolution
                        },
                        apiConfig: node.apiConfig
                    });

                    if (result.success) {
                        visionUtils.setNodeStatus(node, 'success', `connected: ${node.cameraId}`);
                        node.log(`Camera connected: ${node.cameraId}`);
                        return; // Success, exit retry loop
                    }
                } catch (error) {
                    if (attempt < maxRetries) {
                        // Wait before retry
                        visionUtils.setNodeStatus(node, 'processing', `waiting for backend (${attempt}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    } else {
                        // Final attempt failed - silently fail, will auto-connect on capture
                        visionUtils.setNodeStatus(node, 'ready');
                    }
                }
            }
        }

        // Capture image on input
        node.on('input', async function(msg, send, done) {
            // For Node-RED 1.0+ compatibility
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if(err) node.error(err, msg); };

            visionUtils.setNodeStatus(node, 'processing', visionUtils.CONSTANTS.STATUS_TEXT.CAPTURING);

            try {
                // Use camera ID from msg or config
                const cameraId = msg.cameraId || node.cameraId;

                // Extract ROI from previous node's bounding_box if provided
                const roi = msg.payload?.bounding_box || null;

                // Capture image using wrapper
                const result = await visionUtils.callCameraAPI({
                    node: node,
                    endpoint: '/api/camera/capture',
                    requestData: {
                        camera_id: cameraId,
                        params: roi ? { roi: roi } : null
                    },
                    apiConfig: node.apiConfig,
                    done: done
                });

                // VisionResponse format: {objects: [...], image: {...}, thumbnail: "...", processing_time_ms: ...}
                if (!result.objects || result.objects.length === 0) {
                    throw new Error('No objects returned from capture');
                }

                // Extract the single VisionObject from the objects array
                const visionObject = result.objects[0];

                // Create standardized VisionObject message using utility
                const outputMsg = visionUtils.createVisionObjectMessage(
                    visionObject,
                    result.image,
                    result.thumbnail,
                    msg,
                    RED
                );

                // Add metadata in root
                visionUtils.addMessageMetadata(outputMsg, node, result);
                outputMsg.topic = msg.topic || 'mv/camera/' + cameraId;

                visionUtils.setNodeStatus(node, 'success',
                    `captured: ${result.image.id.substring(0, 8)}...`,
                    result.processing_time_ms
                );

                send(outputMsg);
                done();

            } catch (error) {
                // Error already handled by callCameraAPI
                if (!error.handledByUtils) {
                    done(error);
                }
            }
        });

        // Clean up on close
        node.on('close', async function(done) {
            // Disconnect camera if needed
            if (node.cameraId && node.cameraId !== 'test') {
                try {
                    const {apiUrl, headers} = visionUtils.getApiSettings(node.apiConfig);
                    await axios.delete(`${apiUrl}/api/camera/disconnect/${node.cameraId}`, {headers});
                    node.log(`Camera disconnected: ${node.cameraId}`);
                } catch (error) {
                    // Ignore disconnect errors
                }
            }
            done();
        });
    }

    RED.nodes.registerType('mv-camera-capture', MVCameraCaptureNode);
};
