/**
 * Integration tests for config nodes
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('Config Nodes (Mock Integration)', function() {

    let RED, node;

    beforeEach(function() {
        // Mock Node-RED runtime
        RED = {
            nodes: {
                createNode: sinon.stub(),
                registerType: sinon.stub()
            }
        };

        // Create mock node instance
        node = {
            on: sinon.stub(),
            send: sinon.stub(),
            error: sinon.stub(),
            status: sinon.stub(),
            log: sinon.stub(),
            warn: sinon.stub()
        };

        // Make createNode return our mock node
        RED.nodes.createNode.callsFake(function(nodeInstance, config) {
            Object.assign(nodeInstance, node);
        });
    });

    afterEach(function() {
        sinon.restore();
    });

    describe('mv-config', function() {
        let configNode;

        beforeEach(function() {
            configNode = require('../../nodes/config/mv-config.js');
        });

        it('should register with Node-RED', function() {
            configNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-config')).to.be.true;
        });

        it('should register with credentials schema', function() {
            configNode(RED);
            const credentialsSchema = RED.nodes.registerType.getCall(0).args[2];
            expect(credentialsSchema).to.exist;
            expect(credentialsSchema.credentials).to.have.property('apiKey');
            expect(credentialsSchema.credentials).to.have.property('apiToken');
            expect(credentialsSchema.credentials.apiKey).to.have.property('type', 'text');
            expect(credentialsSchema.credentials.apiToken).to.have.property('type', 'password');
        });

        it('should use default apiUrl when not provided', function() {
            configNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const config = {};
            const nodeInstance = new NodeConstructor(config);

            expect(nodeInstance.apiUrl).to.equal('http://localhost:8000');
        });

        it('should use provided apiUrl', function() {
            configNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const config = {
                apiUrl: 'http://custom-backend:9000'
            };
            const nodeInstance = new NodeConstructor(config);

            expect(nodeInstance.apiUrl).to.equal('http://custom-backend:9000');
        });

        it('should use default timeout when not provided', function() {
            configNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const config = {};
            const nodeInstance = new NodeConstructor(config);

            expect(nodeInstance.timeout).to.equal(30000);
        });

        it('should use provided timeout', function() {
            configNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const config = {
                timeout: '60000'
            };
            const nodeInstance = new NodeConstructor(config);

            expect(nodeInstance.timeout).to.equal(60000);
        });

        it('should parse timeout as integer', function() {
            configNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const config = {
                timeout: '45000'
            };
            const nodeInstance = new NodeConstructor(config);

            expect(nodeInstance.timeout).to.be.a('number');
            expect(nodeInstance.timeout).to.equal(45000);
        });

        it('should handle invalid timeout gracefully', function() {
            configNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const config = {
                timeout: 'invalid'
            };
            const nodeInstance = new NodeConstructor(config);

            // parseInt('invalid') returns NaN, which is falsy, so defaults to 30000
            expect(nodeInstance.timeout).to.equal(30000);
        });
    });
});
