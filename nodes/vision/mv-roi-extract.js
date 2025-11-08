module.exports = function(RED) {
    const axios = require('axios');

    function MVROIExtractNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.roi = config.roi || {x: 0, y: 0, width: 100, height: 100};
        node.roiMode = config.roiMode || 'absolute';

        node.status({fill: "grey", shape: "ring", text: "ready"});

        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            try {
                // Get image_id from message payload
                const imageId = msg.payload?.image_id;
                if (!imageId) {
                    throw new Error("No image_id in msg.payload");
                }

                node.status({fill: "blue", shape: "dot", text: "extracting ROI..."});

                // Calculate bounding box based on mode
                let bounding_box;
                const configRoi = {
                    x: parseInt(node.roi.x) || 0,
                    y: parseInt(node.roi.y) || 0,
                    width: parseInt(node.roi.width) || 100,
                    height: parseInt(node.roi.height) || 100
                };

                if (node.roiMode === 'relative' && msg.payload.bounding_box) {
                    // Relative mode: add ROI offset to existing bounding box
                    const inputBox = msg.payload.bounding_box;
                    bounding_box = {
                        x: inputBox.x + configRoi.x,
                        y: inputBox.y + configRoi.y,
                        width: configRoi.width,
                        height: configRoi.height
                    };
                } else {
                    // Absolute mode: use ROI as-is
                    bounding_box = configRoi;
                }

                // Prepare request
                const requestData = {
                    image_id: imageId,
                    roi: bounding_box
                };

                // Get API configuration
                if (!node.apiConfig) {
                    throw new Error('Missing API configuration. Please configure mv-config node.');
                }
                const apiUrl = node.apiConfig.apiUrl || 'http://localhost:8000';
                const timeout = node.apiConfig.timeout || 30000;

                // Build headers
                const headers = {
                    'Content-Type': 'application/json'
                };
                if (node.apiConfig.credentials) {
                    if (node.apiConfig.credentials.apiKey) {
                        headers['X-API-Key'] = node.apiConfig.credentials.apiKey;
                    }
                    if (node.apiConfig.credentials.apiToken) {
                        headers['Authorization'] = `Bearer ${node.apiConfig.credentials.apiToken}`;
                    }
                }

                // Call API
                const response = await axios.post(
                    `${apiUrl}/api/image/extract-roi`,
                    requestData,
                    {
                        timeout: timeout,
                        headers: headers
                    }
                );

                const result = response.data;

                // Update status
                const processingTime = result.processing_time_ms || 0;
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: `ROI extracted: ${result.bounding_box.width}x${result.bounding_box.height} | ${processingTime}ms`
                });

                // Preserve input VisionObject, only update bbox, center, and thumbnail
                const outputPayload = {...msg.payload};
                outputPayload.bounding_box = result.bounding_box;
                outputPayload.center = {
                    x: result.bounding_box.x + result.bounding_box.width / 2,
                    y: result.bounding_box.y + result.bounding_box.height / 2
                };
                outputPayload.thumbnail = result.thumbnail;

                msg.payload = outputPayload;

                // Metadata in message root
                msg.success = true;
                msg.processing_time_ms = processingTime;
                msg.node_name = node.name || "ROI Extract";

                send(msg);
                done();

            } catch (error) {
                node.status({fill: "red", shape: "ring", text: "error"});

                let errorMessage = "ROI extraction failed: ";
                if (error.response) {
                    errorMessage += error.response.data?.detail || error.response.statusText;
                    node.error(errorMessage, msg);
                } else if (error.request) {
                    errorMessage += "No response from server";
                    node.error(errorMessage, msg);
                } else {
                    errorMessage += error.message;
                    node.error(errorMessage, msg);
                }

                done(error);
            }
        });

        node.on('close', function() {
            node.status({});
        });
    }

    RED.nodes.registerType("mv-roi-extract", MVROIExtractNode);
}
