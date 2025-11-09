/**
 * Integration tests for camera nodes
 *
 * Tests mv-image-simulator, mv-camera-capture, and mv-image-import
 * using mock-based approach without full Node-RED runtime.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const nock = require('nock');

describe('Camera Nodes (Mock Integration)', function() {

    let RED, node;

    beforeEach(function() {
        // Mock Node-RED runtime
        RED = {
            nodes: {
                createNode: sinon.stub(),
                registerType: sinon.stub(),
                getNode: sinon.stub()
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
        nock.cleanAll();
    });

    describe('mv-image-simulator', function() {
        let imageSimulatorNode;

        beforeEach(function() {
            imageSimulatorNode = require('../../nodes/camera/mv-image-simulator.js');
        });

        it('should register with Node-RED', function() {
            imageSimulatorNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-image-simulator')).to.be.true;
        });

        it('should set ready status on creation', function() {
            imageSimulatorNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            // Mock API config
            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                name: 'test simulator',
                apiConfig: 'mock-api-config',
                imageSource: 'test',
                autoTrigger: false
            };
            new NodeConstructor(config);

            expect(node.status.called).to.be.true;
        });

        it('should handle input trigger and generate test image', function(done) {
            imageSimulatorNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            // Mock API config
            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock API response - correct endpoint and structure
            nock('http://localhost:8000')
                .post('/api/camera/capture')
                .query({ camera_id: 'test' })
                .reply(200, {
                    success: true,
                    image_id: 'test_123',
                    thumbnail_base64: 'base64_test_image',
                    timestamp: '2025-01-01T12:00:00Z',
                    metadata: {
                        width: 640,
                        height: 480
                    },
                    processing_time_ms: 50
                });

            const config = {
                apiConfig: 'mock-api-config',
                imageSource: 'test',
                testText: 'TEST',
                autoTrigger: false
            };
            const nodeInstance = new NodeConstructor(config);

            // Get input handler
            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            // Override node.send to capture the message
            nodeInstance.send = sinon.stub().callsFake(function(msg) {
                // Verify message structure
                expect(msg).to.have.property('image_id', 'test_123');
                expect(msg).to.have.property('thumbnail', 'base64_test_image');
                expect(msg).to.have.property('payload');
                expect(msg.payload).to.have.property('image_id', 'test_123');
                done();
            });

            const msg = { payload: 'trigger' };
            inputHandler.call(nodeInstance, msg, () => {}, () => {});
        });

        it('should handle API errors gracefully', function(done) {
            imageSimulatorNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock API error - correct endpoint
            nock('http://localhost:8000')
                .post('/api/camera/capture')
                .query({ camera_id: 'test' })
                .reply(500, { error: 'Internal server error' });

            const config = {
                apiConfig: 'mock-api-config',
                imageSource: 'test',
                autoTrigger: false
            };
            const nodeInstance = new NodeConstructor(config);

            // Override node.error to capture error
            nodeInstance.error = sinon.stub().callsFake(function() {
                // Error was logged
                done();
            });

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const msg = { payload: 'trigger' };
            inputHandler.call(nodeInstance, msg, () => {}, () => {});
        });

        it('should start auto-trigger when autoTrigger is true', function(done) {
            this.timeout(2000);

            imageSimulatorNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock API responses for auto-triggered captures
            nock('http://localhost:8000')
                .post('/api/camera/capture')
                .query({ camera_id: 'test' })
                .twice()
                .reply(200, {
                    success: true,
                    image_id: 'auto_123',
                    thumbnail_base64: 'base64_auto_image',
                    timestamp: '2025-01-01T12:00:00Z',
                    metadata: {
                        width: 640,
                        height: 480
                    },
                    processing_time_ms: 50
                });

            const config = {
                apiConfig: 'mock-api-config',
                imageSource: 'test',
                autoTrigger: true,
                triggerInterval: 100  // Short interval for testing
            };

            const nodeInstance = new NodeConstructor(config);
            const sendSpy = sinon.spy();
            nodeInstance.send = sendSpy;

            // Wait for at least one auto-triggered capture
            setTimeout(() => {
                // Verify send was called by auto-trigger
                expect(sendSpy.called).to.be.true;
                expect(nodeInstance.intervalId).to.exist;

                // Clean up
                if (nodeInstance.intervalId) {
                    clearInterval(nodeInstance.intervalId);
                }
                done();
            }, 200);
        });

        it('should handle start command to enable auto-trigger', function(done) {
            this.timeout(2000);

            imageSimulatorNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock API for auto-triggered capture
            nock('http://localhost:8000')
                .post('/api/camera/capture')
                .query({ camera_id: 'test' })
                .reply(200, {
                    success: true,
                    image_id: 'start_cmd_123',
                    thumbnail_base64: 'base64_image',
                    timestamp: '2025-01-01T12:00:00Z',
                    metadata: {
                        width: 640,
                        height: 480
                    },
                    processing_time_ms: 50
                });

            const config = {
                apiConfig: 'mock-api-config',
                imageSource: 'test',
                autoTrigger: false,
                triggerInterval: 100
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];
            const sendSpy = sinon.spy();
            nodeInstance.send = sendSpy;

            const mockDone = sinon.stub().callsFake(function() {
                // Verify interval was started
                expect(nodeInstance.intervalId).to.exist;

                // Wait for auto-trigger to fire
                setTimeout(() => {
                    expect(sendSpy.called).to.be.true;

                    // Clean up
                    if (nodeInstance.intervalId) {
                        clearInterval(nodeInstance.intervalId);
                    }
                    done();
                }, 150);
            });

            const msg = { payload: 'start' };
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should handle stop command to disable auto-trigger', function(done) {
            imageSimulatorNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                imageSource: 'test',
                autoTrigger: false,
                triggerInterval: 100
            };
            const nodeInstance = new NodeConstructor(config);

            // Manually start interval to simulate running auto-trigger
            nodeInstance.intervalId = setInterval(() => {}, 100);
            expect(nodeInstance.intervalId).to.not.be.null;

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                if (err) {
                    done(err);
                } else {
                    // Verify interval was stopped
                    expect(nodeInstance.intervalId).to.be.null;
                    done();
                }
            });

            const msg = { payload: 'stop' };
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should clean up interval on node close', function(done) {
            imageSimulatorNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                imageSource: 'test',
                autoTrigger: false
            };
            const nodeInstance = new NodeConstructor(config);

            // Manually start interval to simulate running auto-trigger
            nodeInstance.intervalId = setInterval(() => {}, 100);
            expect(nodeInstance.intervalId).to.exist;

            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            closeHandler.call(nodeInstance, function() {
                // Verify interval was cleared
                expect(nodeInstance.intervalId).to.be.null;

                // Verify status was cleared
                expect(node.status.calledWith({})).to.be.true;

                done();
            });
        });
    });

    describe('mv-camera-capture', function() {
        let cameraCaptureNode;

        beforeEach(function() {
            cameraCaptureNode = require('../../nodes/camera/mv-camera-capture.js');
        });

        it('should register with Node-RED', function() {
            cameraCaptureNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-camera-capture')).to.be.true;
        });

        it('should set ready status on creation', function() {
            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                name: 'test camera',
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoConnect: false
            };
            new NodeConstructor(config);

            expect(node.status.called).to.be.true;
        });

        it('should capture image on input trigger', function(done) {
            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock capture API response - correct endpoint and structure
            nock('http://localhost:8000')
                .post('/api/camera/capture')
                .reply(200, {
                    success: true,
                    image_id: 'cam1_456',
                    thumbnail_base64: 'base64_camera_image',
                    timestamp: '2025-01-01T12:00:00Z',
                    metadata: {
                        width: 1920,
                        height: 1080
                    },
                    processing_time_ms: 100
                });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoConnect: false,
                resolution: { width: 1920, height: 1080 }
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                // Verify VisionObject structure
                expect(msg.payload).to.have.property('object_type');
                expect(msg.payload).to.have.property('image_id', 'cam1_456');
                expect(msg.payload.properties).to.have.property('camera_id', 'cam1');
                done();
            });

            const msg = { payload: 'capture' };
            inputHandler.call(nodeInstance, msg, send, () => {});
        });

        it('should handle camera connection errors', function(done) {
            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock connection error - correct endpoint
            nock('http://localhost:8000')
                .post('/api/camera/capture')
                .reply(404, { error: 'Camera not found' });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoConnect: false
            };
            const nodeInstance = new NodeConstructor(config);

            // Override node.error to capture error
            nodeInstance.error = sinon.stub().callsFake(function() {
                // Error was logged
                done();
            });

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const msg = { payload: 'capture' };
            inputHandler.call(nodeInstance, msg, () => {}, () => {});
        });

        it('should auto-connect camera on startup when autoConnect is true', function(done) {
            this.timeout(10000);

            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock health check
            nock('http://localhost:8000')
                .get('/api/system/health')
                .reply(200, { status: 'ok' });

            // Mock successful camera connect
            nock('http://localhost:8000')
                .post('/api/camera/connect')
                .reply(200, { success: true });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoConnect: true
            };

            // Create stub for node.log to verify connection was logged
            const logStub = sinon.stub();
            node.log = logStub;

            new NodeConstructor(config);

            // Wait for async auto-connect to complete
            setTimeout(() => {
                // Verify status was set to success
                const statusCalls = node.status.getCalls();
                const successStatus = statusCalls.find(call =>
                    call.args[0].text && call.args[0].text.includes('connected')
                );
                expect(successStatus).to.exist;

                // Verify connection was logged
                expect(logStub.called).to.be.true;
                const logCall = logStub.getCalls().find(call =>
                    call.args[0].includes('Camera connected')
                );
                expect(logCall).to.exist;

                done();
            }, 100);
        });

        it('should retry auto-connect and succeed on second attempt', function(done) {
            this.timeout(10000);

            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // First health check fails
            nock('http://localhost:8000')
                .get('/api/system/health')
                .reply(500, { error: 'Backend not ready' });

            // Second health check succeeds
            nock('http://localhost:8000')
                .get('/api/system/health')
                .reply(200, { status: 'ok' });

            // Camera connect succeeds on second attempt
            nock('http://localhost:8000')
                .post('/api/camera/connect')
                .reply(200, { success: true });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoConnect: true
            };

            const logStub = sinon.stub();
            node.log = logStub;

            new NodeConstructor(config);

            // Wait for retries (2s delay + execution time)
            setTimeout(() => {
                // Verify status shows retry attempts
                const statusCalls = node.status.getCalls();
                const waitingStatus = statusCalls.find(call =>
                    call.args[0].text && call.args[0].text.includes('waiting for backend')
                );
                expect(waitingStatus).to.exist;

                // Verify eventual success
                const successStatus = statusCalls.find(call =>
                    call.args[0].text && call.args[0].text.includes('connected')
                );
                expect(successStatus).to.exist;

                done();
            }, 2500);
        });

        it('should silently fail auto-connect after max retries', function(done) {
            this.timeout(15000);

            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // All health checks fail (5 attempts)
            for (let i = 0; i < 5; i++) {
                nock('http://localhost:8000')
                    .get('/api/system/health')
                    .reply(500, { error: 'Backend not ready' });
            }

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoConnect: true
            };

            new NodeConstructor(config);

            // Wait for all retries to complete (5 retries * 2s = 10s + buffer)
            setTimeout(() => {
                // Verify status was set back to ready after all retries failed
                const statusCalls = node.status.getCalls();
                const finalStatus = statusCalls[statusCalls.length - 1];
                expect(finalStatus.args[0].text).to.equal('ready');

                done();
            }, 11000);
        });

        it('should disconnect camera on node close', function(done) {
            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock disconnect API
            nock('http://localhost:8000')
                .delete('/api/camera/disconnect/cam1')
                .reply(200, { success: true });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoConnect: false
            };
            const nodeInstance = new NodeConstructor(config);

            // Mock node.log
            const logStub = sinon.stub();
            nodeInstance.log = logStub;

            // Get close handler
            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            // Call close handler with done callback
            closeHandler.call(nodeInstance, function() {
                // Verify disconnect was logged
                expect(logStub.called).to.be.true;
                const logCall = logStub.getCalls().find(call =>
                    call.args[0].includes('Camera disconnected')
                );
                expect(logCall).to.exist;

                done();
            });
        });

        it('should not disconnect test camera on close', function(done) {
            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'test',  // Test camera should not disconnect
                autoConnect: false
            };
            const nodeInstance = new NodeConstructor(config);

            const logStub = sinon.stub();
            nodeInstance.log = logStub;

            // Get close handler
            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            // Call close handler
            closeHandler.call(nodeInstance, function() {
                // Verify no disconnect was attempted for test camera
                const logCall = logStub.getCalls().find(call =>
                    call.args[0] && call.args[0].includes('Camera disconnected')
                );
                expect(logCall).to.not.exist;

                done();
            });
        });

        it('should format IP camera URL correctly', function() {
            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                sourceType: 'ip',
                ipCameraUrl: 'rtsp://192.168.1.100/stream',
                autoConnect: false
            };
            const nodeInstance = new NodeConstructor(config);

            expect(nodeInstance.cameraId).to.equal('ip_rtsp://192.168.1.100/stream');
        });

        it('should use camera ID from message when provided', function(done) {
            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock capture with override camera ID
            nock('http://localhost:8000')
                .post('/api/camera/capture', body => body.camera_id === 'cam_override')
                .reply(200, {
                    success: true,
                    image_id: 'override_123',
                    thumbnail_base64: 'base64_override',
                    timestamp: '2025-01-01T12:00:00Z',
                    metadata: {
                        width: 1920,
                        height: 1080
                    },
                    processing_time_ms: 100
                });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',  // Default camera
                autoConnect: false
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                // Verify the image was captured
                expect(msg.payload).to.have.property('image_id', 'override_123');
                done();
            });

            const msg = {
                payload: 'capture',
                cameraId: 'cam_override'  // Override camera ID
            };
            inputHandler.call(nodeInstance, msg, send, () => {});
        });

        it('should handle capture failure when API returns success:false', function(done) {
            cameraCaptureNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock capture API returning success: false
            nock('http://localhost:8000')
                .post('/api/camera/capture')
                .reply(200, {
                    success: false,
                    error: 'Camera capture failed'
                });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoConnect: false
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                // Verify error was passed to done
                expect(err).to.exist;
                expect(err.message).to.include('Capture failed');
                done();
            });

            const msg = { payload: 'capture' };
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });
    });

    describe('mv-image-import', function() {
        let imageImportNode;

        beforeEach(function() {
            imageImportNode = require('../../nodes/camera/mv-image-import.js');
        });

        it('should register with Node-RED', function() {
            imageImportNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-image-import')).to.be.true;
        });

        it('should set ready status on creation', function() {
            imageImportNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                name: 'test import',
                apiConfig: 'mock-api-config',
                imagePath: '/tmp/test.jpg'
            };
            new NodeConstructor(config);

            expect(node.status.called).to.be.true;
        });

        it('should import image from file path', function(done) {
            imageImportNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock import API response - correct endpoint and structure
            nock('http://localhost:8000')
                .post('/api/image/import')
                .reply(200, {
                    success: true,
                    image_id: 'import_789',
                    thumbnail_base64: 'base64_imported_image',
                    timestamp: '2025-01-01T12:00:00Z',
                    metadata: {
                        width: 800,
                        height: 600,
                        source: 'file',
                        file_path: '/tmp/test.jpg',
                        file_size_bytes: 12345
                    },
                    processing_time_ms: 50
                });

            const config = {
                apiConfig: 'mock-api-config',
                imagePath: '/tmp/test.jpg'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                // Verify VisionObject structure
                expect(msg.payload).to.have.property('object_type');
                expect(msg.payload).to.have.property('image_id', 'import_789');
                expect(msg.payload.properties).to.have.property('file_path', '/tmp/test.jpg');
                done();
            });

            const msg = { payload: '/tmp/test.jpg' };
            inputHandler.call(nodeInstance, msg, send, () => {});
        });

        it('should handle missing image path error', function(done) {
            imageImportNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                imagePath: ''
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            // Provide done callback that handles the error
            const mockDone = sinon.stub().callsFake(function(err) {
                // Verify error was passed to done
                expect(err).to.exist;
                expect(err.message).to.include('No file path provided');
                done();
            });

            const msg = { payload: '' };
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should handle import failure when API returns success:false', function(done) {
            imageImportNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock API returning success: false
            nock('http://localhost:8000')
                .post('/api/image/import')
                .reply(200, {
                    success: false,
                    error: 'Import failed for some reason'
                });

            const config = {
                apiConfig: 'mock-api-config',
                imagePath: '/tmp/test.jpg'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                // Verify error was passed to done
                expect(err).to.exist;
                expect(err.message).to.include('Import failed');
                done();
            });

            const msg = { payload: '/tmp/test.jpg' };
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });
    });

    describe('mv-live-preview', function() {
        let livePreviewNode;

        beforeEach(function() {
            livePreviewNode = require('../../nodes/camera/mv-live-preview.js');
        });

        it('should register with Node-RED', function() {
            livePreviewNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-live-preview')).to.be.true;
        });

        it('should set ready status on creation', function() {
            livePreviewNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                name: 'test preview',
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoStart: false
            };
            new NodeConstructor(config);

            expect(node.status.called).to.be.true;
        });

        it('should handle start stream command', function(done) {
            this.timeout(10000);

            livePreviewNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock camera connect and stream start
            nock('http://localhost:8000')
                .post('/api/camera/connect')
                .reply(200, { success: true });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoStart: false
            };
            const nodeInstance = new NodeConstructor(config);

            // Override node.send to capture emitted state
            nodeInstance.send = sinon.stub().callsFake(function(msg) {
                try {
                    expect(msg.payload).to.have.property('streaming', true);
                    expect(msg.payload).to.have.property('camera_id', 'cam1');
                    expect(msg.payload).to.have.property('stream_url');
                    expect(msg.stream_url).to.include('/api/camera/stream/cam1');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const msg = {
                payload: {
                    command: 'start',
                    camera_id: 'cam1'
                }
            };
            inputHandler.call(nodeInstance, msg, () => {}, () => {});
        });

        it('should handle stop stream command', function(done) {
            this.timeout(10000);

            livePreviewNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock stream stop
            nock('http://localhost:8000')
                .post('/api/camera/stream/stop/cam1')
                .reply(200, { success: true });

            const config = {
                apiConfig: 'mock-api-config',
                cameraId: 'cam1',
                autoStart: false
            };
            const nodeInstance = new NodeConstructor(config);

            // Simulate active stream
            nodeInstance.streamActive = true;
            nodeInstance.cameraId = 'cam1';

            // Override node.send to capture emitted state
            nodeInstance.send = sinon.stub().callsFake(function(msg) {
                try {
                    expect(msg.payload).to.have.property('streaming', false);
                    expect(msg.payload).to.have.property('camera_id', 'cam1');
                    expect(msg.payload.stream_url).to.be.null;
                    done();
                } catch (err) {
                    done(err);
                }
            });

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const msg = {
                payload: {
                    command: 'stop'
                }
            };
            inputHandler.call(nodeInstance, msg, () => {}, () => {});
        });

        it('should use default camera ID when not specified', function() {
            livePreviewNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config'
                // No cameraId specified
            };
            const nodeInstance = new NodeConstructor(config);

            expect(nodeInstance.cameraId).to.equal('test'); // Default camera ID from constants
        });
    });
});
