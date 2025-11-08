module.exports = function(RED) {
    function MVConfigNode(config) {
        RED.nodes.createNode(this, config);

        // Store configuration
        this.apiUrl = config.apiUrl || 'http://localhost:8000';
        this.timeout = parseInt(config.timeout) || 30000;

        // Credentials are stored separately by Node-RED
        // Access via this.credentials.apiKey and this.credentials.apiToken
    }

    RED.nodes.registerType("mv-config", MVConfigNode, {
        credentials: {
            apiKey: {type: "text"},
            apiToken: {type: "password"}
        }
    });
}
