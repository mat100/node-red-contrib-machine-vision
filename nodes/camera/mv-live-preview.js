/**
 * Machine Vision Live Preview Node
 * Provides MJPEG stream URL for camera live preview
 */

const visionUtils = require('../lib/vision-utils');

module.exports = function(RED) {
    function MVLivePreviewNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Store configuration
        node.cameraId = config.cameraId || visionUtils.CONSTANTS.CAMERA.DEFAULT_ID;
        node.autoStart = config.autoStart || false;
        node.showControls = config.showControls || true;

        // Stream state
        node.streamActive = false;
        node.streamUrl = null;

        // Set initial status
        visionUtils.setNodeStatus(node, 'ready');

        function emitState({ streaming, cameraId, timestamp }) {
            const resolvedCamera = cameraId || node.cameraId;
            const isStreaming = Boolean(streaming);
            const messageTimestamp = timestamp || new Date().toISOString();
            const {apiUrl} = visionUtils.getApiSettings(node.apiConfig);

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

        async function ensureCameraConnected(cameraId) {
            if (cameraId === visionUtils.CONSTANTS.CAMERA.DEFAULT_ID) {
                // Synthetic frame generator does not need explicit connection
                return true;
            }

            try {
                await visionUtils.callCameraAPI({
                    node: null,  // Don't auto-handle errors, we'll handle them manually
                    endpoint: '/api/camera/connect',
                    requestData: { camera_id: cameraId },
                    apiConfig: node.apiConfig
                });
                node.log(`Camera ${cameraId} ready for streaming`);
                return true;
            } catch (error) {
                const message = error.response?.data?.detail || error.message;
                visionUtils.setNodeStatus(node, 'error', `Connect failed`);
                node.error(`Failed to connect camera ${cameraId}: ${message}`);
                emitState({
                    streaming: false,
                    cameraId,
                    timestamp: new Date().toISOString()
                });
                throw error;
            }
        }

        // Start stream function
        async function startStream(cameraId) {
            if (!cameraId) {
                node.error("No camera ID specified");
                visionUtils.setNodeStatus(node, 'error', 'no camera');
                return;
            }

            if (node.streamActive) {
                if (node.cameraId === cameraId) {
                    // Already streaming this camera – refresh message/state
                    emitState({ streaming: true, cameraId });
                    return;
                }

                // Stop current stream before switching cameras
                await stopStream({ emitMessage: true });
            }

            node.cameraId = cameraId;
            try {
                await ensureCameraConnected(cameraId);
                const {apiUrl} = visionUtils.getApiSettings(node.apiConfig);
                // Build MJPEG stream URL
                node.streamUrl = `${apiUrl}/api/camera/stream/${cameraId}`;
                node.streamActive = true;

                // Update status
                visionUtils.setNodeStatus(node, 'success', `Streaming: ${cameraId}`);

                // Send stream URL in message
                emitState({
                    streaming: true,
                    cameraId,
                    timestamp: new Date().toISOString()
                });
                node.log(`Started MJPEG stream for camera: ${cameraId}`);
            } catch (error) {
                // Error already handled in ensureCameraConnected
            }
        }

        // Stop stream function
        async function stopStream(options = {}) {
            const { emitMessage = true } = options;
            const activeCamera = node.cameraId;

            if (node.streamActive && activeCamera) {
                // Call stop endpoint
                try {
                    await visionUtils.callCameraAPI({
                        node: null,  // Don't auto-handle errors
                        endpoint: `/api/camera/stream/stop/${activeCamera}`,
                        requestData: {},
                        apiConfig: node.apiConfig
                    });
                    node.log(`Stopped stream for camera: ${activeCamera}`);
                } catch (error) {
                    node.warn(`Failed to stop stream: ${error.message}`);
                }
            }

            node.streamActive = false;
            node.streamUrl = null;
            visionUtils.setNodeStatus(node, 'ready', visionUtils.CONSTANTS.STATUS_TEXT.STOPPED);

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
        node.on('input', async function(msg, send, done) {
            // Node-RED 1.0+ compatibility
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            try {
                // Check for control commands in message
                if (msg.payload) {
                    // Start command
                    if (msg.payload.command === 'start' || msg.payload.start === true) {
                        const cameraId = msg.payload.camera_id || msg.camera_id || node.cameraId;
                        if (!node.streamActive) {
                            await startStream(cameraId);
                        } else if (node.cameraId !== cameraId) {
                            await stopStream({ emitMessage: true });
                            setTimeout(() => startStream(cameraId), visionUtils.CONSTANTS.STREAM.RECONNECT_DELAY);
                        } else {
                            emitState({ streaming: true, cameraId });
                        }
                        done();
                        return;
                    }

                    // Stop command
                    if (msg.payload.command === 'stop' || msg.payload.stop === true) {
                        await stopStream();
                        done();
                        return;
                    }

                    // Camera selection
                    if (msg.payload.camera_id) {
                        node.cameraId = msg.payload.camera_id;
                        if (node.streamActive) {
                            // Restart with new camera
                            await stopStream();
                            setTimeout(() => startStream(node.cameraId), visionUtils.CONSTANTS.STREAM.STOP_DELAY);
                        }
                        done();
                        return;
                    }
                }

                // Default action - toggle stream
                if (node.streamActive) {
                    await stopStream();
                } else {
                    await startStream(node.cameraId);
                }
                done();
            } catch (error) {
                done(error);
            }
        });

        // Auto-start if configured
        if (node.autoStart) {
            setTimeout(() => startStream(node.cameraId), visionUtils.CONSTANTS.STREAM.START_DELAY);
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
