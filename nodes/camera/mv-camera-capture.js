module.exports = function(RED) {
    const axios = require('axios');

    function MVCameraCaptureNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Helper to get API URL and build headers
        function getApiSettings() {
            if (!node.apiConfig) {
                throw new Error('Missing API configuration. Please configure mv-config node.');
            }
            const apiUrl = node.apiConfig.apiUrl || 'http://localhost:8000';
            const timeout = node.apiConfig.timeout || 30000;
            const headers = {'Content-Type': 'application/json'};

            if (node.apiConfig.credentials) {
                if (node.apiConfig.credentials.apiKey) {
                    headers['X-API-Key'] = node.apiConfig.credentials.apiKey;
                }
                if (node.apiConfig.credentials.apiToken) {
                    headers['Authorization'] = `Bearer ${node.apiConfig.credentials.apiToken}`;
                }
            }

            return {apiUrl, timeout, headers};
        }

        // Configuration
        node.sourceType = config.sourceType || 'usb';

        // Determine camera ID based on source type
        if (node.sourceType === 'ip' && config.ipCameraUrl) {
            // Format IP camera URL as ip_{url}
            node.cameraId = `ip_${config.ipCameraUrl}`;
        } else {
            // Use configured camera ID (USB or test)
            node.cameraId = config.cameraId || 'test';
        }

        node.autoConnect = config.autoConnect || false;

        // Status
        node.status({fill: "grey", shape: "ring", text: "ready"});

        // Connect to camera on startup if autoConnect
        if (node.autoConnect && node.cameraId) {
            // Wait for backend to be ready, then connect
            connectCameraWithRetry();
        }

        // Connect to camera with retry logic
        async function connectCameraWithRetry(maxRetries = 5, retryDelay = 2000) {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const {apiUrl, headers} = getApiSettings();

                    // Check if backend is available
                    await axios.get(`${apiUrl}/api/system/health`, { timeout: 1000 });

                    // Backend is ready, try to connect camera
                    node.status({fill: "yellow", shape: "ring", text: `connecting (${attempt}/${maxRetries})...`});

                    const response = await axios.post(
                        `${apiUrl}/api/camera/connect`,
                        {
                            camera_id: node.cameraId,
                            resolution: config.resolution
                        },
                        {headers}
                    );

                    if (response.data.success) {
                        node.status({fill: "green", shape: "dot", text: `connected: ${node.cameraId}`});
                        node.log(`Camera connected: ${node.cameraId}`);
                        return; // Success, exit retry loop
                    }
                } catch (error) {
                    if (attempt < maxRetries) {
                        // Wait before retry
                        node.status({fill: "yellow", shape: "ring", text: `waiting for backend (${attempt}/${maxRetries})...`});
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    } else {
                        // Final attempt failed - silently fail, will auto-connect on capture
                        node.status({fill: "grey", shape: "ring", text: "ready"});
                    }
                }
            }
        }

        // Capture image on input
        node.on('input', async function(msg, send, done) {
            // For Node-RED 1.0+ compatibility
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            node.status({fill: "blue", shape: "dot", text: "capturing..."});

            try {
                // Use camera ID from msg or config
                const cameraId = msg.cameraId || node.cameraId;

                // Extract ROI from msg.roi if provided
                const roi = msg.roi || null;

                // Get API settings
                const {apiUrl, headers} = getApiSettings();

                // Capture image with nested params structure
                const response = await axios.post(
                    `${apiUrl}/api/camera/capture`,
                    {
                        camera_id: cameraId,
                        params: roi ? { roi: roi } : null
                    },
                    {headers}
                );

                if (response.data.success) {
                    const metadata = response.data.metadata;
                    const imageId = response.data.image_id;

                    // Build VisionObject in payload
                    msg.payload = {
                        object_id: `img_${imageId.substring(0, 8)}`,
                        object_type: "camera_capture",
                        image_id: imageId,
                        timestamp: response.data.timestamp,
                        bounding_box: {
                            x: 0,
                            y: 0,
                            width: metadata.width,
                            height: metadata.height
                        },
                        center: {
                            x: metadata.width / 2,
                            y: metadata.height / 2
                        },
                        confidence: 1.0,
                        thumbnail: response.data.thumbnail_base64,
                        properties: {
                            camera_id: node.cameraId,
                            resolution: [metadata.width, metadata.height]
                        }
                    };

                    // Metadata in root
                    msg.success = true;
                    msg.processing_time_ms = response.data.processing_time_ms || 0;
                    msg.node_name = node.name || "Camera Capture";

                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: `captured: ${imageId.substring(0, 8)}... | ${msg.processing_time_ms}ms`
                    });

                    send(msg);
                    done();
                } else {
                    throw new Error('Capture failed');
                }

            } catch (error) {
                const errorMsg = error.response?.data?.detail || error.message;
                node.error(`Capture failed: ${errorMsg}`, msg);
                node.status({fill: "red", shape: "dot", text: "capture failed"});
                done(error);
            }
        });

        // Clean up on close
        node.on('close', async function(done) {
            // Disconnect camera if needed
            if (node.cameraId && node.cameraId !== 'test') {
                try {
                    const {apiUrl, headers} = getApiSettings();
                    await axios.delete(`${apiUrl}/api/camera/disconnect/${node.cameraId}`, {headers});
                    node.log(`Camera disconnected: ${node.cameraId}`);
                } catch (error) {
                    // Ignore disconnect errors
                }
            }
            done();
        });
    }

    RED.nodes.registerType("mv-camera-capture", MVCameraCaptureNode);
}
