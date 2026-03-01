module.exports = function(RED) {
    const {
        setNodeStatus,
        addMessageMetadata,
        callVisionAPI,
        validateInput,
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
        node.asymmetryOrientation = config.asymmetryOrientation || 'disabled';

        setNodeStatus(node, 'ready');

        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if(err) node.error(err, msg); };

            const { valid, imageId } = validateInput(node, msg, done);
            if (!valid) return;

            // Get contour from message (required input from edge detection)
            const contour = msg.payload?.contour;
            if (!contour || !Array.isArray(contour)) {
                setNodeStatus(node, 'error', 'missing contour');
                return done(new Error('No contour found in msg.payload.contour'));
            }

            // Prepare request
            const requestData = {
                image_id: imageId,
                contour: contour,
                roi: msg.payload?.bbox || null,  // For visualization context
                params: {
                    method: node.method,
                    angle_range: node.angleRange,
                    asymmetry_orientation: node.asymmetryOrientation
                },
                reference: msg.reference || null  // Pass reference for backend transformation
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
                    throw new Error('No rotation analysis result');
                }

                const obj = result.objects[0];

                // Build output message - preserve original payload and add rotation
                const outputMsg = RED.util.cloneMessage(msg);

                // Update payload with rotation information
                outputMsg.payload.angle = obj.angle;
                outputMsg.payload.rotation_confidence = obj.confidence;
                outputMsg.payload.metadata = {
                    ...outputMsg.payload.metadata,
                    rotation_method: obj.metadata.method,
                    rotation_angle_range: obj.metadata.angle_range,
                    absolute_angle: obj.metadata.absolute_angle
                };

                // Add thickness_ratio if asymmetry orientation was used
                if (obj.metadata.thickness_ratio !== undefined) {
                    outputMsg.payload.metadata.thickness_ratio = obj.metadata.thickness_ratio;
                }

                // Use backend-calculated real-world angle and position if available
                if (obj.real?.angle !== null && obj.real?.angle !== undefined) {
                    outputMsg.payload.real = outputMsg.payload.real || {};
                    outputMsg.payload.real.angle = obj.real.angle;
                }
                if (obj.real?.center !== null && obj.real?.center !== undefined) {
                    outputMsg.payload.real = outputMsg.payload.real || {};
                    outputMsg.payload.real.center = obj.real.center;
                }

                // Update thumbnail
                outputMsg.thumbnail = result.thumbnail;

                // Preserve reference for downstream nodes
                if (msg.reference) {
                    outputMsg.reference = msg.reference;
                }

                // Metadata in root
                addMessageMetadata(outputMsg, node, result);

                // Status message showing absolute and relative angles
                let statusText = `${obj.angle.toFixed(1)}°`;
                if (obj.real?.angle !== null && obj.real?.angle !== undefined) {
                    statusText += ` (ref: ${obj.real.angle.toFixed(1)}°)`;
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

    RED.nodes.registerType('mv-rotation-detect', MVRotationDetectNode);
};
