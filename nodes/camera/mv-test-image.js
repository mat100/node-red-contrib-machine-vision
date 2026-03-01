module.exports = function(RED) {
    const axios = require('axios');
    const visionUtils = require('../lib/vision-utils');

    function MVTestImageNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration - test_id is set when image is uploaded via editor
        node.testId = config.testId || null;
        node.testImageName = config.testImageName || 'Test Image';

        // Status
        if (node.testId) {
            visionUtils.setNodeStatus(node, 'ready', `ready: ${node.testImageName}`);
        } else {
            visionUtils.setNodeStatus(node, 'error', 'no test image uploaded');
        }

        // Capture test image on input (trigger)
        node.on('input', async function(msg, send, done) {
            // For Node-RED 1.0+ compatibility
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if(err) node.error(err, msg); };

            // Check if test image is configured
            if (!node.testId) {
                const error = new Error('No test image configured. Please upload a test image in node settings.');
                visionUtils.setNodeStatus(node, 'error', 'no test image');
                done(error);
                return;
            }

            visionUtils.setNodeStatus(node, 'processing', visionUtils.CONSTANTS.STATUS_TEXT.CAPTURING);

            try {
                // Capture test image (retrieves from backend and stores in ImageManager)
                const result = await visionUtils.callCameraAPI({
                    node: node,
                    endpoint: `/api/test-image/${node.testId}/capture`,
                    method: 'POST',
                    requestData: {},
                    apiConfig: node.apiConfig,
                    done: done
                });

                // New VisionResponse format: {objects: [...], thumbnail_base64: "...", processing_time_ms: ..., test_id: "..."}
                if (!result.objects || result.objects.length === 0) {
                    throw new Error('No objects returned from test image capture');
                }

                // Extract the single VisionObject from the objects array
                const visionObject = result.objects[0];
                const imageId = visionObject.properties.image_id;
                const timestamp = visionUtils.getTimestamp(msg);

                // Create standardized VisionObject message using utility
                const outputMsg = visionUtils.createVisionObjectMessage(
                    visionObject,
                    imageId,
                    timestamp,
                    result.thumbnail_base64,
                    msg,
                    RED
                );

                // Add metadata in root
                visionUtils.addMessageMetadata(outputMsg, node, result, 'Test Image');
                outputMsg.image_id = imageId;
                outputMsg.payload.properties.test_id = result.test_id;
                outputMsg.payload.properties.test_image_name = node.testImageName;

                visionUtils.setNodeStatus(node, 'success',
                    `captured: ${imageId.substring(0, 8)}...`,
                    result.processing_time_ms
                );

                send(outputMsg);
                done();

            } catch (error) {
                // Error already handled by callCameraAPI
                if (!error.handledByUtils) {
                    visionUtils.setNodeStatus(node, 'error', 'capture failed');
                    done(error);
                }
            }
        });

        // Clean up on close (nothing to disconnect for test images)
        node.on('close', async function(done) {
            done();
        });
    }

    RED.nodes.registerType('mv-test-image', MVTestImageNode);

    // HTTP endpoint for uploading test image from editor
    // Use multer for handling multipart/form-data
    const multer = require('multer');
    const upload = multer({ dest: '/tmp/' });

    RED.httpAdmin.post('/mv-test-image/upload/:id', upload.single('testImage'), async function(req, res) {
        const nodeId = req.params.id;
        const node = RED.nodes.getNode(nodeId);

        if (!node) {
            return res.status(404).json({ error: 'Node not found' });
        }

        await visionUtils.handleFileUpload(req, res, {
            backendEndpoint: '/api/test-image/upload',
            apiConfig: node.apiConfig,
            transformResponse: (data) => ({
                success: true,
                test_id: data.test_id,
                filename: data.filename,
                width: data.size.width,
                height: data.size.height
            })
        });
    });

    // HTTP endpoint for listing test images
    RED.httpAdmin.get('/mv-test-image/list', async function(req, res) {
        try {
            // Get API config from query parameter or use default
            let apiUrl = 'http://localhost:8000';
            let headers = {};

            const apiConfigId = req.query.apiConfigId;
            if (apiConfigId) {
                const apiConfig = RED.nodes.getNode(apiConfigId);
                if (apiConfig) {
                    const settings = visionUtils.getApiSettings(apiConfig);
                    apiUrl = settings.apiUrl;
                    headers = settings.headers;
                }
            }

            // List test images from backend
            const response = await axios.get(
                `${apiUrl}/api/test-image/list`,
                { headers }
            );

            res.json({
                success: true,
                test_images: response.data
            });

        } catch (error) {
            res.status(500).json({
                error: error.message || 'Failed to list test images',
                details: error.response ? error.response.data : null
            });
        }
    });
};
