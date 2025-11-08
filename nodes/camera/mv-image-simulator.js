module.exports = function(RED) {
    const axios = require('axios');

    function MVImageSimulatorNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.imageSource = config.imageSource || 'test';
        node.testText = config.testText || 'Test Image';
        node.autoTrigger = config.autoTrigger || false;
        node.triggerInterval = parseInt(config.triggerInterval) || 5000;

        // State
        node.intervalId = null;

        // Status
        node.status({fill: "grey", shape: "ring", text: "ready"});

        // Auto trigger setup
        if (node.autoTrigger) {
            startAutoTrigger();
        }

        function startAutoTrigger() {
            node.intervalId = setInterval(() => {
                captureTestImage();
            }, node.triggerInterval);
            node.status({fill: "green", shape: "dot", text: `auto: ${node.triggerInterval}ms`});
        }

        function stopAutoTrigger() {
            if (node.intervalId) {
                clearInterval(node.intervalId);
                node.intervalId = null;
            }
        }

        async function captureTestImage() {
            try {
                if (!node.apiConfig) {
                    throw new Error('Missing API configuration. Please configure mv-config node.');
                }

                const apiUrl = node.apiConfig.apiUrl || 'http://localhost:8000';
                const headers = {'Content-Type': 'application/json'};
                if (node.apiConfig.credentials) {
                    if (node.apiConfig.credentials.apiKey) {
                        headers['X-API-Key'] = node.apiConfig.credentials.apiKey;
                    }
                    if (node.apiConfig.credentials.apiToken) {
                        headers['Authorization'] = `Bearer ${node.apiConfig.credentials.apiToken}`;
                    }
                }

                node.status({fill: "blue", shape: "dot", text: "generating..."});

                // Call API to capture test image
                const response = await axios.post(
                    `${apiUrl}/api/camera/capture`,
                    null,
                    {
                        params: { camera_id: 'test' },
                        headers: headers
                    }
                );

                if (response.data.success) {
                    const msg = {
                        payload: {
                            image_id: response.data.image_id,
                            timestamp: response.data.timestamp,
                            thumbnail_base64: response.data.thumbnail_base64,
                            metadata: response.data.metadata
                        },
                        image_id: response.data.image_id,
                        thumbnail: response.data.thumbnail_base64
                    };

                    node.send(msg);
                    node.status({fill: "green", shape: "dot", text: "image generated"});
                }

            } catch (error) {
                node.error(`Failed to generate test image: ${error.message}`);
                node.status({fill: "red", shape: "dot", text: "generation failed"});
            }
        }

        // Process input
        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            await captureTestImage();
            done();
        });

        // Control messages
        node.on('input', function(msg) {
            if (msg.payload === 'start') {
                if (!node.intervalId) {
                    startAutoTrigger();
                }
            } else if (msg.payload === 'stop') {
                stopAutoTrigger();
                node.status({fill: "grey", shape: "ring", text: "stopped"});
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
