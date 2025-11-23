module.exports = function(RED) {
    const visionUtils = require('../lib/vision-utils');

    function MVImagePreviewNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Config
        node.imageSource = config.imageSource || 'vision';
        node.height = parseInt(config.height) || 160;
        node.active = config.active !== false;

        visionUtils.setNodeStatus(node, 'ready');

        node.on('input', function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            try {
                // Always pass through the message (toggle doesn't affect flow)
                send(msg);

                // Only display if active
                if (node.active) {
                    let imageData = null;
                    let imageId = null;

                    // Select image source based on configuration
                    if (node.imageSource === 'vision') {
                        imageData = msg.payload?.thumbnail || msg.thumbnail;
                        imageId = msg.payload?.image_id || msg.image_id;
                    } else if (node.imageSource === 'reference') {
                        imageData = msg.reference_object?.thumbnail ||
                                   msg.payload?.reference_object?.thumbnail;
                        // Reference object doesn't have image_id for full download
                        imageId = null;
                    }

                    // Send to editor display
                    const data = {
                        id: node.id,
                        source: node.imageSource
                    };

                    if (imageData) {
                        // Strip data URI prefix if present
                        data.data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
                        data.image_id = imageId;

                        // Update status
                        node.status({
                            fill: 'green',
                            shape: 'dot',
                            text: node.imageSource === 'vision' ? 'vision' : 'reference'
                        });
                    } else {
                        // Clear display if no image
                        node.status({
                            fill: 'grey',
                            shape: 'ring',
                            text: 'no image'
                        });
                    }

                    RED.comms.publish('mv-image-preview', data);
                }

                done();
            } catch (error) {
                node.error(error, msg);
                node.status({
                    fill: 'red',
                    shape: 'dot',
                    text: 'error'
                });
                done(error);
            }
        });

        node.on('close', function() {
            // Clear display on close
            RED.comms.publish('mv-image-preview', { id: node.id });
            node.status({});
        });
    }

    RED.nodes.registerType("mv-image-preview", MVImagePreviewNode);

    // Enable/disable button endpoint (affects only display, not message flow)
    RED.httpAdmin.post("/mv-image-preview/:id/:state",
        RED.auth.needsPermission("mv-image-preview.write"),
        function(req, res) {
            const node = RED.nodes.getNode(req.params.id);
            if (!node) {
                res.sendStatus(404);
                return;
            }

            if (req.params.state === "enable") {
                node.active = true;
                res.send('enabled');
            } else if (req.params.state === "disable") {
                node.active = false;
                // Clear display when disabled
                RED.comms.publish('mv-image-preview', { id: node.id });
                node.status({
                    fill: 'grey',
                    shape: 'ring',
                    text: 'disabled'
                });
                res.send('disabled');
            } else {
                res.sendStatus(404);
            }
        }
    );
};
