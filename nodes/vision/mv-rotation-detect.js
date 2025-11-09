module.exports = function(RED) {
    const {
        setNodeStatus,
        callVisionAPI,
        getImageId,
        getTimestamp,
        CONSTANTS
    } = require('../lib/vision-utils');

    function MVRotationDetectNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.method = config.method || CONSTANTS.ROTATION_DETECT.DEFAULT_METHOD;
        node.angleRange = config.angleRange || CONSTANTS.ROTATION_DETECT.DEFAULT_ANGLE_RANGE;

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

            // Get contour from message (required input from edge detection)
            const contour = msg.payload?.contour;
            if (!contour || !Array.isArray(contour)) {
                node.error("No contour found in msg.payload.contour", msg);
                setNodeStatus(node, 'error', 'missing contour');
                return done(new Error("No contour found in msg.payload.contour"));
            }

            // Prepare request
            const requestData = {
                image_id: imageId,
                contour: contour,
                roi: msg.payload?.bounding_box || null,  // For visualization context
                params: {
                    method: node.method,
                    angle_range: node.angleRange
                }
            };

            try {
                // Call API with unified error handling
                const result = await callVisionAPI({
                    node: node,
                    endpoint: '/api/vision/rotation-detect',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                if (!result.objects || result.objects.length === 0) {
                    throw new Error("No rotation analysis result");
                }

                const obj = result.objects[0];
                const timestamp = getTimestamp(msg);

                // Build output message - preserve original payload and add rotation
                const outputMsg = RED.util.cloneMessage(msg);

                // Update payload with rotation information
                outputMsg.payload.rotation = obj.rotation;
                outputMsg.payload.rotation_confidence = obj.confidence;
                outputMsg.payload.properties = {
                    ...outputMsg.payload.properties,
                    rotation_method: obj.properties.method,
                    rotation_angle_range: obj.properties.angle_range,
                    absolute_angle: obj.properties.absolute_angle
                };

                // Calculate relative rotation if reference_object exists (from ArUco detection)
                if (msg.reference_object && typeof msg.reference_object.rotation === 'number') {
                    let relativeAngle = obj.rotation - msg.reference_object.rotation;

                    // Normalize based on angle range setting
                    if (node.angleRange === '0_360') {
                        while (relativeAngle < 0) relativeAngle += 360;
                        while (relativeAngle >= 360) relativeAngle -= 360;
                    } else if (node.angleRange === '-180_180') {
                        while (relativeAngle < -180) relativeAngle += 360;
                        while (relativeAngle > 180) relativeAngle -= 360;
                    } else if (node.angleRange === '0_180') {
                        while (relativeAngle < 0) relativeAngle += 180;
                        while (relativeAngle >= 180) relativeAngle -= 180;
                    }

                    outputMsg.payload.rotation_relative = relativeAngle;
                    outputMsg.payload.properties.reference_angle = msg.reference_object.rotation;
                    outputMsg.payload.properties.reference_marker_id = msg.reference_object.marker_id;
                }

                // Update thumbnail
                outputMsg.payload.thumbnail = result.thumbnail_base64;

                // Preserve reference_object for downstream nodes
                if (msg.reference_object) {
                    outputMsg.reference_object = msg.reference_object;
                }

                // Metadata in root
                outputMsg.success = true;
                outputMsg.processing_time_ms = result.processing_time_ms;
                outputMsg.node_name = node.name || "Rotation Detection";

                // Status message showing absolute and relative angles
                let statusText = `${obj.rotation.toFixed(1)}°`;
                if (outputMsg.payload.rotation_relative !== undefined) {
                    statusText += ` (Δ${outputMsg.payload.rotation_relative.toFixed(1)}°)`;
                }

                setNodeStatus(node, 'success', statusText, result.processing_time_ms);

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

    RED.nodes.registerType("mv-rotation-detect", MVRotationDetectNode);
}
