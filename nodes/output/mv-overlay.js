module.exports = function(RED) {
    function MVOverlayNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.status({fill: "grey", shape: "ring", text: "ready"});

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