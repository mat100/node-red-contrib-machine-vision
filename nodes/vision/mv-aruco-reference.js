module.exports = function(RED) {
    const {
        setNodeStatus,
        addMessageMetadata,
        callVisionAPI,
        validateInput,
        CONSTANTS
    } = require('../lib/vision-utils');

    function MVArucoReferenceNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.dictionary = config.dictionary || CONSTANTS.ARUCO_DETECT.DICTIONARY;
        node.mode = config.mode || 'single';

        // Single marker config
        node.singleMarkerId = parseInt(config.singleMarkerId) || 0;
        node.singleMarkerSize = parseFloat(config.singleMarkerSize) || 50.0;
        node.singleOrigin = config.singleOrigin || 'marker_center';
        node.singleRotationRef = config.singleRotationRef || 'marker_rotation';

        // Plane config
        node.planeMarkerIds = config.planeMarkerIds || {
            top_left: 0,
            top_right: 1,
            bottom_right: 2,
            bottom_left: 3
        };
        node.planeWidth = parseFloat(config.planeWidth) || 200.0;
        node.planeHeight = parseFloat(config.planeHeight) || 150.0;
        node.planeOrigin = config.planeOrigin || 'top_left';
        node.planeXDirection = config.planeXDirection || 'right';
        node.planeYDirection = config.planeYDirection || 'down';

        setNodeStatus(node, 'ready');

        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if(err) node.error(err, msg); };

            const { valid, imageId } = validateInput(node, msg, done);
            if (!valid) return;

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

            // Prepare mode-specific configuration
            let params;
            if (node.mode === 'single') {
                params = {
                    dictionary: node.dictionary,
                    mode: 'single',
                    single_config: {
                        marker_id: node.singleMarkerId,
                        marker_size_mm: node.singleMarkerSize,
                        origin: node.singleOrigin,
                        rotation_reference: node.singleRotationRef
                    }
                };
            } else if (node.mode === 'plane') {
                params = {
                    dictionary: node.dictionary,
                    mode: 'plane',
                    plane_config: {
                        marker_ids: node.planeMarkerIds,
                        width_mm: node.planeWidth,
                        height_mm: node.planeHeight,
                        origin: node.planeOrigin,
                        x_direction: node.planeXDirection,
                        y_direction: node.planeYDirection
                    }
                };
            } else {
                node.error(`Invalid mode: ${node.mode}`, msg);
                setNodeStatus(node, 'error', 'invalid mode');
                return done(new Error(`Invalid mode: ${node.mode}`));
            }

            // Prepare request
            const requestData = {
                image_id: imageId,
                roi: roi,
                params: params
            };

            try {
                // Call API with unified error handling
                const result = await callVisionAPI({
                    node: node,
                    endpoint: '/api/vision/aruco-reference',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                // Forward pattern: Clone message, add reference_object, preserve payload
                const outputMsg = RED.util.cloneMessage(msg);

                // Add reference_object to message
                outputMsg.reference_object = result.reference_object;

                // Add metadata in root
                addMessageMetadata(outputMsg, node, result, 'ArUco Reference');
                outputMsg.markers = result.markers; // Include detected markers for debugging

                // Update status
                const modeLabel = node.mode === 'single' ? 'single' : 'plane';
                const countMsg = `${modeLabel}: ${result.markers.length} markers`;
                setNodeStatus(node, 'success', countMsg, result.processing_time_ms);

                // Send single message
                send(outputMsg);
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

    RED.nodes.registerType('mv-aruco-reference', MVArucoReferenceNode);
};
