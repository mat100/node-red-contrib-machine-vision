module.exports = function(RED) {
    const visionUtils = require('../lib/vision-utils');

    function MVImageSimulatorNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.imageSource = config.imageSource || visionUtils.CONSTANTS.SIMULATOR.TEST_IMAGE_SOURCE;
        node.testText = config.testText || visionUtils.CONSTANTS.SIMULATOR.DEFAULT_TEXT;
        node.autoTrigger = config.autoTrigger || false;
        node.triggerInterval = parseInt(config.triggerInterval) || visionUtils.CONSTANTS.SIMULATOR.DEFAULT_TRIGGER_INTERVAL;

        // State
        node.intervalId = null;

        // Status
        visionUtils.setNodeStatus(node, 'ready');

        // Auto trigger setup
        if (node.autoTrigger) {
            startAutoTrigger();
        }

        function startAutoTrigger() {
            node.intervalId = setInterval(() => {
                captureTestImage();
            }, node.triggerInterval);
            visionUtils.setNodeStatus(node, 'success', `auto: ${node.triggerInterval}ms`);
        }

        function stopAutoTrigger() {
            if (node.intervalId) {
                clearInterval(node.intervalId);
                node.intervalId = null;
            }
        }

        async function captureTestImage() {
            try {
                visionUtils.setNodeStatus(node, 'processing', visionUtils.CONSTANTS.STATUS_TEXT.GENERATING);

                // Call API to capture test image using wrapper
                const result = await visionUtils.callCameraAPI({
                    node: node,
                    endpoint: '/api/camera/capture',
                    requestData: null,
                    params: { camera_id: visionUtils.CONSTANTS.CAMERA.DEFAULT_ID },
                    apiConfig: node.apiConfig
                });

                if (result.success) {
                    const msg = {
                        payload: {
                            image_id: result.image_id,
                            timestamp: result.timestamp,
                            thumbnail_base64: result.thumbnail_base64,
                            metadata: result.metadata
                        },
                        image_id: result.image_id,
                        thumbnail: result.thumbnail_base64
                    };

                    node.send(msg);
                    visionUtils.setNodeStatus(node, 'success', 'image generated');
                }

            } catch (error) {
                // Error already handled by callCameraAPI wrapper
                visionUtils.setNodeStatus(node, 'error', 'generation failed');
            }
        }

        // Process input - unified handler for both control commands and image capture
        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            try {
                // Check for control commands first
                if (msg.payload === 'start') {
                    if (!node.intervalId) {
                        startAutoTrigger();
                    }
                    done();
                } else if (msg.payload === 'stop') {
                    stopAutoTrigger();
                    visionUtils.setNodeStatus(node, 'ready', visionUtils.CONSTANTS.STATUS_TEXT.STOPPED);
                    done();
                } else {
                    // Regular message - capture test image
                    await captureTestImage();
                    done();
                }
            } catch (error) {
                done(error);
            }
        });

        // Clean up
        node.on('close', function(done) {
            stopAutoTrigger();
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("mv-image-simulator", MVImageSimulatorNode);
}
