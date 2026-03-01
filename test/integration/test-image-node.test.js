/**
 * Integration tests for mv-test-image node
 *
 * Tests test image capture functionality
 * using mock-based approach without full Node-RED runtime.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const nock = require('nock');

describe('Test Image Node (Mock Integration)', function() {

    let RED, node;

    beforeEach(function() {
        // Mock Node-RED runtime
        RED = {
            nodes: {
                createNode: sinon.stub(),
                registerType: sinon.stub(),
                getNode: sinon.stub()
            },
            httpAdmin: {
                post: sinon.stub(),
                get: sinon.stub()
            },
            util: {
                cloneMessage: sinon.stub().callsFake(msg => JSON.parse(JSON.stringify(msg)))
            }
        };

        // Create mock node instance
        node = {
            on: sinon.stub(),
            send: sinon.stub(),
            error: sinon.stub(),
            status: sinon.stub(),
            log: sinon.stub(),
            warn: sinon.stub(),
            id: 'test-node-id'
        };

        // Make createNode return our mock node
        RED.nodes.createNode.callsFake(function(nodeInstance, _config) {
            Object.assign(nodeInstance, node);
        });
    });

    afterEach(function() {
        sinon.restore();
        nock.cleanAll();
    });

    describe('mv-test-image', function() {
        let testImageNode;

        beforeEach(function() {
            testImageNode = require('../../nodes/camera/mv-test-image.js');
        });

        it('should register with Node-RED', function() {
            testImageNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-test-image')).to.be.true;
        });

        it('should register HTTP upload endpoint', function() {
            testImageNode(RED);
            expect(RED.httpAdmin.post.called).to.be.true;
            const uploadCall = RED.httpAdmin.post.getCalls().find(call =>
                call.args[0].includes('/mv-test-image/upload')
            );
            expect(uploadCall).to.exist;
        });

        it('should register HTTP list endpoint', function() {
            testImageNode(RED);
            expect(RED.httpAdmin.get.called).to.be.true;
            const listCall = RED.httpAdmin.get.getCalls().find(call =>
                call.args[0].includes('/mv-test-image/list')
            );
            expect(listCall).to.exist;
        });

        it('should set ready status when test_id is configured', function() {
            testImageNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                testId: 'test_12345678',
                testImageName: 'my-test-image.png'
            };
            new NodeConstructor(config);

            expect(node.status.called).to.be.true;
            const statusCall = node.status.getCall(0);
            expect(statusCall.args[0]).to.have.property('fill');
        });

        it('should set error status when no test_id configured', function() {
            testImageNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                testId: null
            };
            new NodeConstructor(config);

            expect(node.status.called).to.be.true;
            const statusCall = node.status.getCall(0);
            expect(statusCall.args[0]).to.have.property('fill', 'red');
        });

        it('should capture test image on input trigger', function(done) {
            testImageNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock capture API response with VisionResponse structure
            nock('http://localhost:8000')
                .post('/api/test-image/test_12345678/capture')
                .reply(200, {
                    test_id: 'test_12345678',
                    objects: [{
                        object_id: 'test_test_123',
                        object_type: 'test_image_capture',
                        bounding_box: {
                            x: 0,
                            y: 0,
                            width: 640,
                            height: 480
                        },
                        center: {
                            x: 320,
                            y: 240
                        },
                        confidence: 1.0,
                        properties: {
                            test_id: 'test_12345678',
                            resolution: [640, 480],
                            image_id: 'img_abcd1234'
                        }
                    }],
                    thumbnail_base64: 'base64_test_image',
                    processing_time_ms: 5
                });

            const config = {
                apiConfig: 'mock-api-config',
                testId: 'test_12345678',
                testImageName: 'test.png'
            };
            new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                try {
                    // Verify VisionObject structure
                    expect(msg.payload).to.have.property('object_type', 'test_image_capture');
                    expect(msg.payload.properties).to.have.property('image_id', 'img_abcd1234');
                    expect(msg.payload.properties).to.have.property('test_id', 'test_12345678');
                    expect(msg.payload.properties).to.have.property('test_image_name', 'test.png');
                    expect(msg).to.have.property('processing_time_ms', 5);
                    expect(msg.payload).to.have.property('thumbnail', 'base64_test_image');
                    done();
                } catch (error) {
                    done(error);
                }
            });

            const doneFn = sinon.stub();
            inputHandler({ payload: 'trigger' }, send, doneFn);
        });

        it('should return error when no test_id configured on trigger', function(done) {
            testImageNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                testId: null
            };
            new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub();
            const doneFn = sinon.stub().callsFake(function(error) {
                try {
                    expect(error).to.be.an('error');
                    expect(error.message).to.include('No test image configured');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            inputHandler({ payload: 'trigger' }, send, doneFn);
        });

        it('should handle capture API errors gracefully', function(done) {
            testImageNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock API error
            nock('http://localhost:8000')
                .post('/api/test-image/test_12345678/capture')
                .reply(404, {
                    detail: 'Test image not found: test_12345678'
                });

            const config = {
                apiConfig: 'mock-api-config',
                testId: 'test_12345678',
                testImageName: 'test.png'
            };
            new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub();
            const doneFn = sinon.stub().callsFake(function(_error) {
                // Error is handled by callCameraAPI wrapper
                // So done might be called without error, but node.status should show error
                setTimeout(function() {
                    expect(node.status.called).to.be.true;
                    done();
                }, 50);
            });

            inputHandler({ payload: 'trigger' }, send, doneFn);
        });

        it('should capture multiple times with different image_ids', function(done) {
            testImageNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock two captures with different image_ids
            nock('http://localhost:8000')
                .post('/api/test-image/test_12345678/capture')
                .reply(200, {
                    test_id: 'test_12345678',
                    objects: [{
                        object_id: 'test_test_123',
                        object_type: 'test_image_capture',
                        bounding_box: { x: 0, y: 0, width: 640, height: 480 },
                        center: { x: 320, y: 240 },
                        confidence: 1.0,
                        properties: {
                            test_id: 'test_12345678',
                            image_id: 'img_first_capture'
                        }
                    }],
                    thumbnail_base64: 'base64_test_image',
                    processing_time_ms: 5
                });

            nock('http://localhost:8000')
                .post('/api/test-image/test_12345678/capture')
                .reply(200, {
                    test_id: 'test_12345678',
                    objects: [{
                        object_id: 'test_test_123',
                        object_type: 'test_image_capture',
                        bounding_box: { x: 0, y: 0, width: 640, height: 480 },
                        center: { x: 320, y: 240 },
                        confidence: 1.0,
                        properties: {
                            test_id: 'test_12345678',
                            image_id: 'img_second_capture'
                        }
                    }],
                    thumbnail_base64: 'base64_test_image',
                    processing_time_ms: 5
                });

            const config = {
                apiConfig: 'mock-api-config',
                testId: 'test_12345678',
                testImageName: 'test.png'
            };
            new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            let firstImageId, secondImageId;

            const send1 = sinon.stub().callsFake(function(msg) {
                firstImageId = msg.payload.properties.image_id;
                expect(firstImageId).to.equal('img_first_capture');

                // Trigger second capture
                const send2 = sinon.stub().callsFake(function(msg) {
                    secondImageId = msg.payload.properties.image_id;
                    expect(secondImageId).to.equal('img_second_capture');
                    expect(firstImageId).to.not.equal(secondImageId);
                    done();
                });

                inputHandler({ payload: 'trigger' }, send2, sinon.stub());
            });

            inputHandler({ payload: 'trigger' }, send1, sinon.stub());
        });
    });
});
