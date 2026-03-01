module.exports = function(RED) {
    const {
        setNodeStatus,
        createVisionObjectMessage,
        addMessageMetadata,
        callVisionAPI,
        validateInput
    } = require('../lib/vision-utils');

    function MVFeatureTemplateMatchNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Basic template configuration
        node.templateId = config.templateId;
        node.threshold = parseFloat(config.threshold) || 0.6;

        // Feature matching parameters
        node.minMatches = parseInt(config.minMatches) || 10;
        node.ratioThreshold = parseFloat(config.ratioThreshold) || 0.75;

        // Multi-instance configuration
        node.findMultiple = config.findMultiple !== undefined ? config.findMultiple : false;
        node.maxMatches = parseInt(config.maxMatches) || 10;

        // Set initial status
        setNodeStatus(node, 'ready');

        // Process input
        node.on('input', async function(msg, send, done) {
            // For Node-RED 1.0+ compatibility
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if(err) node.error(err, msg); };

            const { valid, imageId } = validateInput(node, msg, done);
            if (!valid) return;

            // Get template ID
            const templateId = msg.templateId || node.templateId;
            if (!templateId) {
                setNodeStatus(node, 'error', 'missing template');
                return done(new Error('No template_id configured'));
            }

            // Prepare request
            const requestData = {
                image_id: imageId,
                roi: msg.payload?.bbox || null,
                params: {
                    template_id: templateId,
                    threshold: node.threshold,
                    min_matches: node.minMatches,
                    ratio_threshold: node.ratioThreshold,
                    find_multiple: node.findMultiple,
                    max_matches: node.maxMatches
                }
            };

            try {
                // Call API with unified error handling
                const result = await callVisionAPI({
                    node: node,
                    endpoint: '/api/vision/feature-template-match',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                // 0 objects = send nothing
                if (!result.objects || result.objects.length === 0) {
                    setNodeStatus(node, 'no_results', 'not found', result.processing_time_ms);
                    done();
                    return;
                }

                // Send N messages for N objects using utility function
                for (let i = 0; i < result.objects.length; i++) {
                    const obj = result.objects[i];

                    // Use utility to create standardized VisionObject message
                    const outputMsg = createVisionObjectMessage(
                        obj,
                        msg.image,
                        result.thumbnail,
                        msg,
                        RED
                    );

                    // Add metadata in root
                    addMessageMetadata(outputMsg, node, result);

                    send(outputMsg);
                }

                // Update status with count
                let countMsg = `${result.objects.length} match${result.objects.length > 1 ? 'es' : ''}`;
                setNodeStatus(node, 'success', countMsg, result.processing_time_ms);

                done();

            } catch (error) {
                // Error already handled by callVisionAPI
                // Just ensure done is called (may have been called already)
                if (!error.handledByUtils) {
                    done(error);
                }
            }
        });

        // Clean up
        node.on('close', function(done) {
            node.status({});
            done();
        });
    }

    RED.nodes.registerType('mv-feature-template-match', MVFeatureTemplateMatchNode);
};
