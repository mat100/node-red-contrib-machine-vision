module.exports = function(RED) {
    const {
        setNodeStatus,
        createVisionObjectMessage,
        callVisionAPI,
        getImageId,
        getTimestamp,
        CONSTANTS
    } = require('../lib/vision-utils');

    function MVColorDetectNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.expectedColor = config.expectedColor || '';  // Empty = any color
        node.minPercentage = parseFloat(config.minPercentage) || CONSTANTS.COLOR_DETECT.DEFAULT_MIN_PERCENTAGE;
        node.method = config.method || CONSTANTS.COLOR_DETECT.DEFAULT_METHOD;
        node.useContourMask = config.useContourMask !== false;  // Default true

        setNodeStatus(node, 'ready');

        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            // Extract image_id using utility
            const imageId = getImageId(msg);
            if (!imageId) {
                node.error("No image_id provided", msg);
                setNodeStatus(node, 'error', 'missing image_id');
                return done(new Error("No image_id provided"));
            }

            // Get ROI from payload.bounding_box (INPUT constraint from previous detection)
            let roi = null;
            let contour = null;
            if (msg.payload?.bounding_box) {
                roi = msg.payload.bounding_box;
                contour = msg.payload.contour;  // Extract contour from edge detection for precise masking
            } else if (msg.roi) {
                roi = msg.roi;
            }

            // Build request
            const requestData = {
                image_id: imageId,
                roi: roi,
                contour: contour,
                params: {
                    use_contour_mask: node.useContourMask,
                    expected_color: node.expectedColor || null,
                    min_percentage: node.minPercentage,
                    method: node.method
                }
            };

            try {
                // Call API with unified error handling
                const result = await callVisionAPI({
                    node: node,
                    endpoint: '/api/vision/color-detect',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                // 0 objects = send nothing (color not found or doesn't match)
                if (!result.objects || result.objects.length === 0) {
                    const statusText = node.expectedColor ? 'mismatch' : 'no color';
                    setNodeStatus(node, 'no_results', statusText, result.processing_time_ms);
                    done();
                    return;
                }

                // Color detection returns exactly 1 object
                const obj = result.objects[0];
                const timestamp = getTimestamp(msg);

                // Use utility to create standardized VisionObject message
                const outputMsg = createVisionObjectMessage(
                    obj,
                    imageId,
                    timestamp,
                    result.thumbnail_base64,
                    msg,
                    RED
                );

                // Add metadata in root
                outputMsg.success = true;
                outputMsg.processing_time_ms = result.processing_time_ms;
                outputMsg.node_name = node.name || "Color Detection";

                send(outputMsg);

                // Status shows detected color
                const detectedColor = obj.properties?.dominant_color || 'unknown';
                setNodeStatus(node, 'success', detectedColor, result.processing_time_ms);

                done();

            } catch (error) {
                // Error already handled by callVisionAPI
                if (!error.handledByUtils) {
                    done(error);
                }
            }
        });

        node.on('close', function() {
            node.status({});
        });
    }

    RED.nodes.registerType("mv-color-detect", MVColorDetectNode);
}
