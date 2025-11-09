module.exports = function(RED) {
    const visionUtils = require('../lib/vision-utils');

    function MVOverlayNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        visionUtils.setNodeStatus(node, 'ready');

        node.on('input', function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            // Pass through the thumbnail for display
            if (msg.thumbnail || msg.payload?.thumbnail_base64) {
                msg.payload = msg.thumbnail || msg.payload.thumbnail_base64;
            }

            send(msg);
            done();
        });
    }

    RED.nodes.registerType("mv-overlay", MVOverlayNode);
}