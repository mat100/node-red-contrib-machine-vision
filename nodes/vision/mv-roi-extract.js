module.exports = function(RED) {
    const visionUtils = require('../lib/vision-utils');

    function MVROIExtractNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.roi = config.roi || {
            x: visionUtils.CONSTANTS.ROI.DEFAULT_X,
            y: visionUtils.CONSTANTS.ROI.DEFAULT_Y,
            width: visionUtils.CONSTANTS.ROI.DEFAULT_WIDTH,
            height: visionUtils.CONSTANTS.ROI.DEFAULT_HEIGHT
        };
        node.roiMode = config.roiMode || visionUtils.CONSTANTS.ROI.MODE_ABSOLUTE;

        visionUtils.setNodeStatus(node, 'ready');

        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            try {
                // Get and validate image_id from message payload
                const imageId = msg.payload?.image_id;
                if (!imageId) {
                    throw new Error("No image_id in msg.payload");
                }

                // Validate image ID for security
                const imageIdValidation = visionUtils.validateImageId(imageId);
                if (!imageIdValidation.valid) {
                    visionUtils.setNodeStatus(node, 'error', 'invalid image_id');
                    throw new Error(imageIdValidation.error);
                }

                visionUtils.setNodeStatus(node, 'processing', visionUtils.CONSTANTS.STATUS_TEXT.EXTRACTING_ROI);

                // Calculate bounding box based on mode
                let bounding_box;
                const configRoi = {
                    x: parseInt(node.roi.x) || visionUtils.CONSTANTS.ROI.DEFAULT_X,
                    y: parseInt(node.roi.y) || visionUtils.CONSTANTS.ROI.DEFAULT_Y,
                    width: parseInt(node.roi.width) || visionUtils.CONSTANTS.ROI.DEFAULT_WIDTH,
                    height: parseInt(node.roi.height) || visionUtils.CONSTANTS.ROI.DEFAULT_HEIGHT
                };

                if (node.roiMode === visionUtils.CONSTANTS.ROI.MODE_RELATIVE && msg.payload.bounding_box) {
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

                // Validate ROI coordinates
                const roiValidation = visionUtils.validateROI(bounding_box);
                if (!roiValidation.valid) {
                    visionUtils.setNodeStatus(node, 'error', 'invalid ROI');
                    throw new Error(roiValidation.error);
                }

                visionUtils.debugLog(node, 'roi-extract', 'Extracting ROI', {
                    image_id: imageId,
                    roi: bounding_box,
                    mode: node.roiMode
                });

                // Prepare request
                const requestData = {
                    image_id: imageId,
                    roi: bounding_box
                };

                // Call API using wrapper
                const result = await visionUtils.callImageAPI({
                    node: node,
                    endpoint: '/api/image/extract-roi',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                // Update status
                const processingTime = result.processing_time_ms || 0;
                visionUtils.setNodeStatus(node, 'success',
                    `ROI extracted: ${result.bounding_box.width}x${result.bounding_box.height}`,
                    processingTime
                );

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
                // Error already handled by callImageAPI
                if (!error.response) {
                    // Only handle non-API errors here
                    done(error);
                }
            }
        });

        node.on('close', function() {
            visionUtils.setNodeStatus(node, 'clear');
        });
    }

    RED.nodes.registerType("mv-roi-extract", MVROIExtractNode);
}
