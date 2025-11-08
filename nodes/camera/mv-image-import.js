module.exports = function(RED) {
    const axios = require('axios');

    function MVImageImportNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Configuration
        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Status
        node.status({fill: "grey", shape: "ring", text: "ready"});

        // Import image on input
        node.on('input', async function(msg, send, done) {
            // For Node-RED 1.0+ compatibility
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            node.status({fill: "blue", shape: "dot", text: "importing..."});

            try {
                // Get file path from msg.filepath or msg.payload
                const filePath = msg.filepath || (typeof msg.payload === 'string' ? msg.payload : null);

                if (!filePath) {
                    throw new Error('No file path provided. Use msg.filepath or msg.payload');
                }

                // Get API configuration
                if (!node.apiConfig) {
                    throw new Error('Missing API configuration. Please configure mv-config node.');
                }
                const apiUrl = node.apiConfig.apiUrl || 'http://localhost:8000';
                const headers = {'Content-Type': 'application/json'};
                if (node.apiConfig.credentials) {
                    if (node.apiConfig.credentials.apiKey) {
                        headers['X-API-Key'] = node.apiConfig.credentials.apiKey;
                    }
                    if (node.apiConfig.credentials.apiToken) {
                        headers['Authorization'] = `Bearer ${node.apiConfig.credentials.apiToken}`;
                    }
                }

                // Import image via API
                const response = await axios.post(
                    `${apiUrl}/api/image/import`,
                    {
                        file_path: filePath
                    },
                    {headers}
                );

                if (response.data.success) {
                    const metadata = response.data.metadata;
                    const imageId = response.data.image_id;

                    // Build VisionObject in payload (same structure as camera capture)
                    msg.payload = {
                        object_id: `img_${imageId.substring(0, 8)}`,
                        object_type: "file_import",
                        image_id: imageId,
                        timestamp: response.data.timestamp,
                        bounding_box: {
                            x: 0,
                            y: 0,
                            width: metadata.width,
                            height: metadata.height
                        },
                        center: {
                            x: metadata.width / 2,
                            y: metadata.height / 2
                        },
                        confidence: 1.0,
                        thumbnail: response.data.thumbnail_base64,
                        properties: {
                            source: metadata.source,
                            file_path: metadata.file_path,
                            file_size_bytes: metadata.file_size_bytes,
                            resolution: [metadata.width, metadata.height]
                        }
                    };

                    // Metadata in root
                    msg.success = true;
                    msg.processing_time_ms = 0;
                    msg.node_name = node.name || "Image Import";

                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: `imported: ${imageId.substring(0, 8)}...`
                    });

                    send(msg);
                    done();
                } else {
                    throw new Error('Import failed');
                }

            } catch (error) {
                const errorMsg = error.response?.data?.detail || error.message;
                node.error(`Import failed: ${errorMsg}`, msg);
                node.status({fill: "red", shape: "dot", text: "import failed"});
                done(error);
            }
        });
    }

    RED.nodes.registerType("mv-image-import", MVImageImportNode);
}
