module.exports = function(RED) {
    const axios = require('axios');
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
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

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

                if (result.success) {
                    const metadata = result.metadata;
                    const imageId = result.image_id;

                    // Build VisionObject using utility
                    const visionObject = visionUtils.createCameraVisionObject(
                        imageId,
                        result.timestamp,
                        metadata,
                        result.thumbnail_base64,
                        visionUtils.CONSTANTS.OBJECT_TYPES.IMAGE_IMPORT
                    );

                    // Add file-specific properties
                    visionObject.properties = {
                        source: metadata.source,
                        file_path: metadata.file_path,
                        file_size_bytes: metadata.file_size_bytes,
                        resolution: [metadata.width, metadata.height]
                    };

                    msg.payload = visionObject;

                    // Metadata in root
                    msg.success = true;
                    msg.processing_time_ms = 0;
                    msg.node_name = node.name || "Image Import";

                    visionUtils.setNodeStatus(node, 'success', `imported: ${imageId.substring(0, 8)}...`);

                    send(msg);
                    done();
                } else {
                    throw new Error('Import failed');
                }

            } catch (error) {
                // Error already handled by callImageAPI
                if (!error.response) {
                    // Only handle non-API errors here
                    visionUtils.setNodeStatus(node, 'error', 'import failed');
                    done(error);
                }
            }
        });
    }

    RED.nodes.registerType("mv-image-import", MVImageImportNode);
}
