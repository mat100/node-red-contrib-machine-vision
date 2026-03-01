module.exports = function(RED) {
    const visionUtils = require('../lib/vision-utils');

    function MVImageImportNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Status
        visionUtils.setNodeStatus(node, 'ready');

        // Import image on input
        node.on('input', async function(msg, send, done) {
            // For Node-RED 1.0+ compatibility
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if(err) node.error(err, msg); };

            visionUtils.setNodeStatus(node, 'processing', visionUtils.CONSTANTS.STATUS_TEXT.IMPORTING);

            try {
                // Get file path from msg.filepath or msg.payload
                const filePath = msg.filepath || (typeof msg.payload === 'string' ? msg.payload : null);

                if (!filePath) {
                    throw new Error('No file path provided. Use msg.filepath or msg.payload');
                }

                // Import image via API using wrapper
                const result = await visionUtils.callImageAPI({
                    node: node,
                    endpoint: '/api/image/import',
                    requestData: { file_path: filePath },
                    apiConfig: node.apiConfig,
                    done: done
                });

                // VisionResponse format: {objects: [...], image: {...}, thumbnail: "...", processing_time_ms: ...}
                if (!result.objects || result.objects.length === 0) {
                    throw new Error('No objects returned from import');
                }

                // Extract the single VisionObject from the objects array
                const visionObject = result.objects[0];

                // Create standardized VisionObject message using utility
                const outputMsg = visionUtils.createVisionObjectMessage(
                    visionObject,
                    result.image,
                    result.thumbnail,
                    msg,
                    RED
                );

                // Add metadata in root
                visionUtils.addMessageMetadata(outputMsg, node, result);
                outputMsg.topic = msg.topic || 'mv/import';

                visionUtils.setNodeStatus(node, 'success', `imported: ${result.image.id.substring(0, 8)}...`);

                send(outputMsg);
                done();

            } catch (error) {
                // Error already handled by callImageAPI
                if (!error.handledByUtils) {
                    visionUtils.setNodeStatus(node, 'error', 'import failed');
                    done(error);
                }
            }
        });
    }

    RED.nodes.registerType('mv-image-import', MVImageImportNode);
};
