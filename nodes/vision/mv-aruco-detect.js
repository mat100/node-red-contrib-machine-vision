module.exports = function(RED) {
    const {
        setNodeStatus,
        createVisionObjectMessage,
        callVisionAPI,
        getImageId,
        getTimestamp
    } = require('../lib/vision-utils');

    function MVArucoDetectNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.dictionary = config.dictionary || 'DICT_4X4_50';

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

            // Extract ROI from payload.bounding_box (INPUT constraint)
            let roi = null;
            if (msg.payload?.bounding_box) {
                const bbox = msg.payload.bounding_box;
                roi = {
                    x: bbox.x,
                    y: bbox.y,
                    width: bbox.width,
                    height: bbox.height
                };
            } else if (msg.roi) {
                roi = msg.roi;
            }

            // Prepare request
            const requestData = {
                image_id: imageId,
                dictionary: node.dictionary,
                roi: roi,
                params: {}
            };

            try {
                // Call API with unified error handling
                const result = await callVisionAPI({
                    node: node,
                    endpoint: '/api/vision/aruco-detect',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                // 0 markers = send nothing
                if (!result.objects || result.objects.length === 0) {
                    setNodeStatus(node, 'no_results', 'no markers', result.processing_time_ms);
                    done();
                    return;
                }

                // Send N messages for N markers using utility function
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

                    // Set reference_object for first marker (primary reference for rotation calculations)
                    if (i === 0) {
                        outputMsg.reference_object = {
                            rotation: obj.rotation,
                            center: obj.center,
                            marker_id: obj.properties.marker_id,
                            object_type: obj.object_type
                        };
                    } else {
                        // Preserve reference_object from first marker
                        const firstMarker = result.objects[0];
                        outputMsg.reference_object = {
                            rotation: firstMarker.rotation,
                            center: firstMarker.center,
                            marker_id: firstMarker.properties.marker_id,
                            object_type: firstMarker.object_type
                        };
                    }

                    // Add metadata in root
                    outputMsg.success = true;
                    outputMsg.processing_time_ms = result.processing_time_ms;
                    outputMsg.node_name = node.name || "ArUco Detection";

                    send(outputMsg);
                }

                // Update status with count
                const countMsg = `${result.objects.length} marker${result.objects.length > 1 ? 's' : ''}`;
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

    RED.nodes.registerType("mv-aruco-detect", MVArucoDetectNode);
}
