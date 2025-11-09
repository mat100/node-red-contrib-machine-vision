module.exports = function(RED) {
    const {
        setNodeStatus,
        createVisionObjectMessage,
        callVisionAPI,
        getImageId,
        getTimestamp,
        buildEdgeDetectParams
    } = require('../lib/vision-utils');

    function MVEdgeDetectNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.method = config.method || 'canny';
        node.cannyLow = config.cannyLow || 50;
        node.cannyHigh = config.cannyHigh || 150;
        node.sobelThreshold = config.sobelThreshold || 50;
        node.laplacianThreshold = config.laplacianThreshold || 30;

        // Preprocessing options
        node.blurEnabled = config.blurEnabled || false;
        node.blurKernel = config.blurKernel || 5;
        node.bilateralEnabled = config.bilateralEnabled || false;
        node.morphologyEnabled = config.morphologyEnabled || false;
        node.morphologyOperation = config.morphologyOperation || 'close';

        // Contour filters
        node.minContourArea = config.minContourArea || 10;
        node.maxContourArea = config.maxContourArea || 100000;
        node.maxContours = config.maxContours || 20;

        // Set initial status
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

            // Prepare request with explicit fields using parameter builder
            // Map bounding_box from previous detection to roi parameter (INPUT constraint)
            const requestData = {
                image_id: imageId,
                roi: msg.payload?.bounding_box || null,
                params: buildEdgeDetectParams({
                    method: node.method,
                    cannyLow: node.cannyLow,
                    cannyHigh: node.cannyHigh,
                    sobelThreshold: node.sobelThreshold,
                    laplacianThreshold: node.laplacianThreshold,
                    minContourArea: node.minContourArea,
                    maxContourArea: node.maxContourArea,
                    maxContours: node.maxContours,
                    blurEnabled: node.blurEnabled,
                    blurKernel: node.blurKernel,
                    bilateralEnabled: node.bilateralEnabled,
                    morphologyEnabled: node.morphologyEnabled,
                    morphologyOperation: node.morphologyOperation
                })
            };

            try {
                // Call API with unified error handling
                const result = await callVisionAPI({
                    node: node,
                    endpoint: '/api/vision/edge-detect',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                // 0 objects = send nothing
                if (!result.objects || result.objects.length === 0) {
                    setNodeStatus(node, 'no_results', 'no edges', result.processing_time_ms);
                    done();
                    return;
                }

                // Send N messages for N objects using utility function
                const timestamp = getTimestamp(msg);

                for (let i = 0; i < result.objects.length; i++) {
                    const obj = result.objects[i];

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
                    outputMsg.node_name = node.name || "Edge Detection";

                    send(outputMsg);
                }

                // Update status with count
                const countMsg = `${result.objects.length} contour${result.objects.length > 1 ? 's' : ''}`;
                setNodeStatus(node, 'success', countMsg, result.processing_time_ms);

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

    RED.nodes.registerType("mv-edge-detect", MVEdgeDetectNode);
}
