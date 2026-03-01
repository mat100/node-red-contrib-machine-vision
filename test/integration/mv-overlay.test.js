/**
 * Integration tests for mv-overlay node
 *
 * Note: These are mock-based integration tests that test node behavior
 * without requiring full Node-RED runtime.
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('mv-overlay Node (Mock Integration)', function() {

    let RED, overlayNode, node;

    beforeEach(function() {
        // Mock Node-RED runtime
        RED = {
            nodes: {
                createNode: sinon.stub(),
                registerType: sinon.stub()
            }
        };

        // Load the node
        overlayNode = require('../../nodes/output/mv-overlay.js');

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
        RED.nodes.createNode.callsFake(function(nodeInstance, _config) {
            Object.assign(nodeInstance, node);
        });
    });

    afterEach(function() {
        sinon.restore();
    });

    it('should register with Node-RED', function() {
        // Initialize the node module
        overlayNode(RED);

        expect(RED.nodes.registerType.calledOnce).to.be.true;
        expect(RED.nodes.registerType.calledWith('mv-overlay')).to.be.true;
    });

    it('should set ready status on creation', function() {
        // Initialize the node module and get constructor
        overlayNode(RED);
        const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

        // Create node instance
        const config = { name: 'test overlay' };
        new NodeConstructor(config);

        // Verify status was set
        expect(node.status.called).to.be.true;
    });

    it('should pass through thumbnail from msg.payload.thumbnail', function(done) {
        // Initialize the node module and get constructor
        overlayNode(RED);
        const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

        // Create node instance - this will register the 'input' handler
        new NodeConstructor({});

        // Get the input handler that was registered
        const inputHandlerCall = node.on.withArgs('input').getCall(0);
        expect(inputHandlerCall).to.not.be.null;
        const inputHandler = inputHandlerCall.args[1];

        // Mock send and done functions
        const send = sinon.stub();
        const mockDone = sinon.stub().callsFake(function() {
            // Verify the message was sent with thumbnail as payload
            expect(send.calledOnce).to.be.true;
            const sentMsg = send.getCall(0).args[0];
            expect(sentMsg.payload).to.equal('base64_thumbnail_data');
            done();
        });

        // Simulate input message with VisionObject payload containing thumbnail
        const msg = {
            payload: {
                thumbnail: 'base64_thumbnail_data',
                object_type: 'edge_contour'
            }
        };

        inputHandler.call(node, msg, send, mockDone);
    });

    it('should pass through message unchanged when no thumbnail present', function(done) {
        // Initialize the node module
        overlayNode(RED);
        const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

        // Create node instance
        new NodeConstructor({});

        // Get the input handler that was registered
        const inputHandler = node.on.withArgs('input').getCall(0).args[1];

        // Mock send and done functions
        const send = sinon.stub();
        const mockDone = sinon.stub().callsFake(function() {
            expect(send.calledOnce).to.be.true;
            const sentMsg = send.getCall(0).args[0];
            // Payload should remain unchanged when no thumbnail
            expect(sentMsg.payload).to.deep.equal({ object_type: 'edge_contour' });
            done();
        });

        // Simulate input message without thumbnail
        const msg = {
            payload: {
                object_type: 'edge_contour'
            }
        };

        inputHandler.call(node, msg, send, mockDone);
    });

    it('should extract thumbnail from standard VisionObject message', function(done) {
        // Initialize the node module
        overlayNode(RED);
        const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

        // Create node instance
        new NodeConstructor({});

        // Get the input handler that was registered
        const inputHandler = node.on.withArgs('input').getCall(0).args[1];

        // Mock send and done functions
        const send = sinon.stub();
        const mockDone = sinon.stub().callsFake(function() {
            expect(send.calledOnce).to.be.true;
            const sentMsg = send.getCall(0).args[0];
            expect(sentMsg.payload).to.equal('thumb_data');
            done();
        });

        // Full VisionObject message as produced by createVisionObjectMessage
        const msg = {
            success: true,
            processing_time_ms: 42,
            payload: {
                object_id: 'obj_1',
                object_type: 'edge_contour',
                image_id: 'img_123',
                thumbnail: 'thumb_data',
                bounding_box: { x: 0, y: 0, width: 100, height: 100 },
                center: { x: 50, y: 50 },
                confidence: 0.95,
                properties: {}
            }
        };

        inputHandler.call(node, msg, send, mockDone);
    });

    it('should work without send/done callbacks (Node-RED 0.x compatibility)', function() {
        // Initialize the node module
        overlayNode(RED);
        const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

        // Create node instance
        const nodeInstance = new NodeConstructor({});

        // Get the input handler that was registered
        const inputHandler = node.on.withArgs('input').getCall(0).args[1];

        // Create spy for node.send
        const sendSpy = sinon.spy();
        nodeInstance.send = sendSpy;

        // Simulate input message WITHOUT providing send/done
        const msg = {
            payload: {
                thumbnail: 'test_thumbnail',
                object_type: 'camera_capture'
            }
        };

        // Call handler without send/done - this triggers the fallback compatibility code
        inputHandler.call(nodeInstance, msg);

        // Verify node.send was called via fallback
        expect(sendSpy.calledOnce).to.be.true;
        expect(sendSpy.getCall(0).args[0].payload).to.equal('test_thumbnail');
    });
});
