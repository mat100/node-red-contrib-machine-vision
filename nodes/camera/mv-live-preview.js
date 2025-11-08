/**
 * Machine Vision Live Preview Node
 * Provides MJPEG stream URL for camera live preview
 */

const axios = require('axios');

module.exports = function(RED) {
    function MVLivePreviewNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Helper to get API settings
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

        // Store configuration
        node.cameraId = config.cameraId || 'test';
        node.autoStart = config.autoStart || false;
        node.showControls = config.showControls || true;

        // Stream state
        node.streamActive = false;
        node.streamUrl = null;

        // Set initial status
        this.status({ fill: "grey", shape: "ring", text: "Ready" });

        function emitState({ streaming, cameraId, timestamp }) {
            const resolvedCamera = cameraId || node.cameraId;
            const isStreaming = Boolean(streaming);
            const messageTimestamp = timestamp || new Date().toISOString();
            const {apiUrl} = getApiSettings();

            node.send({
                payload: {
                    streaming: isStreaming,
                    camera_id: resolvedCamera,
                    stream_url: isStreaming ? node.streamUrl : null,
                    timestamp: messageTimestamp,
                    api_url: apiUrl
                },
                stream_url: isStreaming ? node.streamUrl : null,
                camera_id: resolvedCamera,
                api_url: apiUrl
            });
        }

        function ensureCameraConnected(cameraId) {
            if (cameraId === 'test') {
                // Synthetic frame generator does not need explicit connection
                return Promise.resolve(true);
            }

            const {apiUrl, headers} = getApiSettings();

            return axios.post(`${apiUrl}/api/camera/connect`, {
                camera_id: cameraId
            }, {headers}).then(() => {
                node.log(`Camera ${cameraId} ready for streaming`);
                return true;
            }).catch(error => {
                const message = error.response && error.response.data && error.response.data.detail
                    ? error.response.data.detail
                    : error.message;
                node.status({ fill: "red", shape: "ring", text: `Connect failed: ${message}` });
                node.error(`Failed to connect camera ${cameraId}: ${message}`);
                emitState({
                    streaming: false,
                    cameraId,
                    timestamp: new Date().toISOString()
                });
                throw error;
            });
        }

        // Start stream function
        function startStream(cameraId) {
            if (!cameraId) {
                node.error("No camera ID specified");
                node.status({ fill: "red", shape: "ring", text: "No camera" });
                return;
            }

            if (node.streamActive) {
                if (node.cameraId === cameraId) {
                    // Already streaming this camera – refresh message/state
                    emitState({ streaming: true, cameraId });
                    return;
                }

                // Stop current stream before switching cameras
                stopStream({ emitMessage: true });
            }

            node.cameraId = cameraId;
            ensureCameraConnected(cameraId)
                .then(() => {
                    const {apiUrl} = getApiSettings();
                    // Build MJPEG stream URL
                    node.streamUrl = `${apiUrl}/api/camera/stream/${cameraId}`;
                    node.streamActive = true;

                    // Update status
                    node.status({ fill: "green", shape: "dot", text: `Streaming: ${cameraId}` });

                    // Send stream URL in message
                    emitState({
                        streaming: true,
                        cameraId,
                        timestamp: new Date().toISOString()
                    });
                    node.log(`Started MJPEG stream for camera: ${cameraId}`);
                })
                .catch(() => {
                    // Error already handled in ensureCameraConnected
                });
        }

        // Stop stream function
        function stopStream(options = {}) {
            const { emitMessage = true } = options;
            const activeCamera = node.cameraId;

            if (node.streamActive && activeCamera) {
                const {apiUrl, headers} = getApiSettings();
                // Call stop endpoint
                axios.post(`${apiUrl}/api/camera/stream/stop/${activeCamera}`, {}, {headers})
                    .then(response => {
                        node.log(`Stopped stream for camera: ${activeCamera}`);
                    })
                    .catch(error => {
                        node.warn(`Failed to stop stream: ${error.message}`);
                    });
            }

            node.streamActive = false;
            node.streamUrl = null;
            node.status({ fill: "grey", shape: "ring", text: "Stopped" });

            // Send stop message
            if (emitMessage) {
                emitState({
                    streaming: false,
                    cameraId: activeCamera,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Handle input messages
        node.on('input', function(msg) {
            // Check for control commands in message
            if (msg.payload) {
                // Start command
                if (msg.payload.command === 'start' || msg.payload.start === true) {
                    const cameraId = msg.payload.camera_id || msg.camera_id || node.cameraId;
                    if (!node.streamActive) {
                        startStream(cameraId);
                    } else if (node.cameraId !== cameraId) {
                        stopStream({ emitMessage: true });
                        setTimeout(() => startStream(cameraId), 300);
                    } else {
                        emitState({ streaming: true, cameraId });
                    }
                    return;
                }

                // Stop command
                if (msg.payload.command === 'stop' || msg.payload.stop === true) {
                    stopStream();
                    return;
                }

                // Camera selection
                if (msg.payload.camera_id) {
                    node.cameraId = msg.payload.camera_id;
                    if (node.streamActive) {
                        // Restart with new camera
                        stopStream();
                        setTimeout(() => startStream(node.cameraId), 500);
                    }
                    return;
                }
            }

            // Default action - toggle stream
            if (node.streamActive) {
                stopStream();
            } else {
                startStream(node.cameraId);
            }
        });

        // Auto-start if configured
        if (node.autoStart) {
            setTimeout(() => startStream(node.cameraId), 1000);
        } else {
            // Emit initial state for dashboard templates
            emitState({
                streaming: false,
                cameraId: node.cameraId,
                timestamp: new Date().toISOString()
            });
        }

        // Cleanup on node removal or redeploy
        node.on('close', function(done) {
            if (node.streamActive) {
                stopStream({ emitMessage: false });
            }
            done();
        });
    }

    RED.nodes.registerType("mv-live-preview", MVLivePreviewNode);
};
