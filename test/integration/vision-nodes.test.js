/**
 * Integration tests for vision nodes
 *
 * Tests mv-template-match, mv-edge-detect, mv-color-detect,
 * mv-aruco-detect, mv-rotation-detect using mock-based approach
 */

const { expect } = require('chai');
const sinon = require('sinon');
const nock = require('nock');

describe('Vision Nodes (Mock Integration)', function() {

    let RED, node;

    beforeEach(function() {
        // Mock Node-RED runtime
        RED = {
            nodes: {
                createNode: sinon.stub(),
                registerType: sinon.stub(),
                getNode: sinon.stub()
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

    describe('mv-template-match', function() {
        let templateMatchNode;

        beforeEach(function() {
            templateMatchNode = require('../../nodes/vision/mv-template-match.js');
        });

        it('should register with Node-RED', function() {
            templateMatchNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-template-match')).to.be.true;
        });

        it('should set ready status on creation', function() {
            templateMatchNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                name: 'test template',
                apiConfig: 'mock-api-config',
                templateId: 'tmpl_test'
            };
            new NodeConstructor(config);

            expect(node.status.called).to.be.true;
        });

        it('should detect template and send VisionObject message', function(done) {
            this.timeout(10000); // Increase timeout for debugging

            templateMatchNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock successful template match response - match any body
            const scope = nock('http://localhost:8000')
                .post('/api/vision/template-match', () => true)
                .reply(200, {
                    success: true,
                    objects: [{
                        object_type: 'template_match',
                        bounding_box: { x: 100, y: 200, width: 50, height: 60 },
                        confidence: 0.95,
                        properties: {
                            template_id: 'tmpl_test',
                            match_method: 'TM_CCOEFF_NORMED'
                        }
                    }],
                    thumbnail_base64: 'base64_result_image',
                    processing_time_ms: 120
                });

            const config = {
                apiConfig: 'mock-api-config',
                templateId: 'tmpl_test',
                threshold: 0.8
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                try {
                    // Verify VisionObject structure
                    expect(msg.payload).to.have.property('object_type', 'template_match');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            const mockDone = sinon.stub().callsFake(function(err) {
                if (err) {
                    console.log('Error in done:', err.message);
                    done(err);
                }
            });

            const msg = {
                image_id: 'img_123',
                payload: { timestamp: Date.now() }
            };

            // Check nock before calling
            setTimeout(() => {
                if (!scope.isDone()) {
                    console.log('Nock not matched!');
                    console.log('Pending:', nock.pendingMocks());
                    done(new Error('HTTP mock was not called'));
                }
            }, 3000);

            inputHandler.call(nodeInstance, msg, send, mockDone);
        });

        it('should send nothing when no matches found', function(done) {
            templateMatchNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock no results response
            nock('http://localhost:8000')
                .post('/api/vision/template-match')
                .reply(200, {
                    success: true,
                    objects: [],
                    processing_time_ms: 80
                });

            const config = {
                apiConfig: 'mock-api-config',
                templateId: 'tmpl_test'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub();
            const mockDone = sinon.stub().callsFake(function() {
                // Verify no message was sent
                expect(send.called).to.be.false;
                done();
            });

            const msg = { image_id: 'img_123' };
            inputHandler.call(nodeInstance, msg, send, mockDone);
        });
    });

    describe('mv-edge-detect', function() {
        let edgeDetectNode;

        beforeEach(function() {
            edgeDetectNode = require('../../nodes/vision/mv-edge-detect.js');
        });

        it('should register with Node-RED', function() {
            edgeDetectNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-edge-detect')).to.be.true;
        });

        it('should detect edges and send VisionObject messages', function(done) {
            this.timeout(10000);

            edgeDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock edge detection response with contours - match any body
            nock('http://localhost:8000')
                .post('/api/vision/edge-detect', () => true)
                .reply(200, {
                    success: true,
                    objects: [
                        {
                            object_type: 'edge_contour',
                            bounding_box: { x: 10, y: 20, width: 30, height: 40 },
                            confidence: 1.0,
                            properties: {
                                area: 1200,
                                perimeter: 140,
                                method: 'canny'
                            }
                        }
                    ],
                    thumbnail_base64: 'base64_edges',
                    processing_time_ms: 150
                });

            const config = {
                apiConfig: 'mock-api-config',
                method: 'canny',
                cannyLow: 50,
                cannyHigh: 150
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                try {
                    expect(msg.payload).to.have.property('object_type', 'edge_contour');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            const mockDone = sinon.stub().callsFake(function(err) {
                if (err) done(err);
            });

            const msg = {
                image_id: 'img_456',
                payload: { timestamp: Date.now() }
            };
            inputHandler.call(nodeInstance, msg, send, mockDone);
        });
    });

    describe('mv-color-detect', function() {
        let colorDetectNode;

        beforeEach(function() {
            colorDetectNode = require('../../nodes/vision/mv-color-detect.js');
        });

        it('should register with Node-RED', function() {
            colorDetectNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-color-detect')).to.be.true;
        });

        it('should detect colors and send VisionObject messages', function(done) {
            colorDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock color detection response
            nock('http://localhost:8000')
                .post('/api/vision/color-detect')
                .reply(200, {
                    success: true,
                    objects: [
                        {
                            object_type: 'color_region',
                            bounding_box: { x: 50, y: 60, width: 80, height: 90 },
                            confidence: 0.88,
                            properties: {
                                color: 'red',
                                percentage: 65.5,
                                area: 7200
                            }
                        }
                    ],
                    thumbnail_base64: 'base64_color',
                    processing_time_ms: 95
                });

            const config = {
                apiConfig: 'mock-api-config',
                expectedColor: 'red',
                minPercentage: 50.0
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                expect(msg.payload).to.have.property('object_type', 'color_region');
                expect(msg.payload.properties).to.have.property('color', 'red');
                expect(msg.payload.properties.percentage).to.be.greaterThan(50);
                done();
            });

            const msg = { image_id: 'img_789' };
            inputHandler.call(nodeInstance, msg, send, () => {});
        });
    });

    describe('mv-aruco-detect', function() {
        let arucoDetectNode;

        beforeEach(function() {
            arucoDetectNode = require('../../nodes/vision/mv-aruco-detect.js');
        });

        it('should register with Node-RED', function() {
            arucoDetectNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-aruco-detect')).to.be.true;
        });

        it('should detect ArUco markers and send VisionObject messages', function(done) {
            arucoDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock ArUco detection response
            nock('http://localhost:8000')
                .post('/api/vision/aruco-detect')
                .reply(200, {
                    success: true,
                    objects: [
                        {
                            object_type: 'aruco_marker',
                            bounding_box: { x: 120, y: 140, width: 100, height: 100 },
                            confidence: 1.0,
                            properties: {
                                marker_id: 42,
                                dictionary: 'DICT_4X4_50',
                                corners: [[120,140], [220,140], [220,240], [120,240]]
                            }
                        }
                    ],
                    thumbnail_base64: 'base64_aruco',
                    processing_time_ms: 110
                });

            const config = {
                apiConfig: 'mock-api-config',
                dictionary: 'DICT_4X4_50'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                expect(msg.payload).to.have.property('object_type', 'aruco_marker');
                expect(msg.payload.properties).to.have.property('marker_id', 42);
                expect(msg.payload.properties).to.have.property('corners');
                done();
            });

            const msg = { image_id: 'img_aruco' };
            inputHandler.call(nodeInstance, msg, send, () => {});
        });
    });

    describe('mv-rotation-detect', function() {
        let rotationDetectNode;

        beforeEach(function() {
            rotationDetectNode = require('../../nodes/vision/mv-rotation-detect.js');
        });

        it('should register with Node-RED', function() {
            rotationDetectNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-rotation-detect')).to.be.true;
        });

        it('should detect rotation and send VisionObject message', function(done) {
            this.timeout(10000);

            rotationDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock rotation detection response - match any body
            nock('http://localhost:8000')
                .post('/api/vision/rotation-detect', () => true)
                .reply(200, {
                    success: true,
                    objects: [
                        {
                            rotation: 45.5,  // Direct property, not in properties
                            confidence: 0.92,
                            properties: {
                                method: 'min_area_rect',
                                angle_range: '0_360',
                                absolute_angle: 45.5,
                                center: [275, 310]
                            }
                        }
                    ],
                    thumbnail_base64: 'base64_rotation',
                    processing_time_ms: 130
                });

            const config = {
                apiConfig: 'mock-api-config',
                method: 'min_area_rect'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                try {
                    // rotation-detect modifies the original message, adding rotation info
                    expect(msg.payload).to.have.property('rotation', 45.5);
                    expect(msg.payload).to.have.property('rotation_confidence', 0.92);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            const mockDone = sinon.stub().callsFake(function(err) {
                if (err) done(err);
            });

            const msg = {
                image_id: 'img_rotation',
                payload: {
                    timestamp: Date.now(),
                    contour: [[100, 100], [200, 100], [200, 200], [100, 200]] // Required for rotation detect
                }
            };
            inputHandler.call(nodeInstance, msg, send, mockDone);
        });
    });

    describe('mv-roi-extract', function() {
        let roiExtractNode;

        beforeEach(function() {
            roiExtractNode = require('../../nodes/vision/mv-roi-extract.js');
        });

        it('should register with Node-RED', function() {
            roiExtractNode(RED);
            expect(RED.nodes.registerType.calledOnce).to.be.true;
            expect(RED.nodes.registerType.calledWith('mv-roi-extract')).to.be.true;
        });

        it('should extract ROI in absolute mode', function(done) {
            this.timeout(10000);

            roiExtractNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock ROI extract API response
            nock('http://localhost:8000')
                .post('/api/image/extract-roi', () => true)
                .reply(200, {
                    success: true,
                    bounding_box: { x: 100, y: 100, width: 200, height: 200 },
                    thumbnail: 'base64_roi_image',
                    processing_time_ms: 50
                });

            const config = {
                apiConfig: 'mock-api-config',
                roiMode: 'absolute',
                roi: { x: 100, y: 100, width: 200, height: 200 }
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                try {
                    expect(msg.payload).to.have.property('bounding_box');
                    expect(msg.payload.bounding_box).to.deep.equal({ x: 100, y: 100, width: 200, height: 200 });
                    expect(msg.payload).to.have.property('center');
                    expect(msg.payload.center.x).to.equal(200); // x + width/2
                    expect(msg.payload.center.y).to.equal(200); // y + height/2
                    done();
                } catch (err) {
                    done(err);
                }
            });

            const mockDone = sinon.stub().callsFake(function(err) {
                if (err) done(err);
            });

            const msg = {
                payload: {
                    image_id: 'img_123',
                    timestamp: Date.now()
                }
            };
            inputHandler.call(nodeInstance, msg, send, mockDone);
        });

        it('should extract ROI in relative mode', function(done) {
            this.timeout(10000);

            roiExtractNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock ROI extract API response
            nock('http://localhost:8000')
                .post('/api/image/extract-roi', () => true)
                .reply(200, {
                    success: true,
                    bounding_box: { x: 150, y: 175, width: 50, height: 75 },
                    thumbnail: 'base64_roi_relative',
                    processing_time_ms: 45
                });

            const config = {
                apiConfig: 'mock-api-config',
                roiMode: 'relative',
                roi: { x: 50, y: 75, width: 50, height: 75 }
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const send = sinon.stub().callsFake(function(msg) {
                try {
                    expect(msg.payload.bounding_box).to.exist;
                    done();
                } catch (err) {
                    done(err);
                }
            });

            const mockDone = sinon.stub().callsFake(function(err) {
                if (err) done(err);
            });

            const msg = {
                payload: {
                    image_id: 'img_456',
                    bounding_box: { x: 100, y: 100, width: 300, height: 300 }
                }
            };
            inputHandler.call(nodeInstance, msg, send, mockDone);
        });

        it('should handle missing image_id error', function(done) {
            roiExtractNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                expect(err).to.exist;
                expect(err.message).to.include('No image_id');
                done();
            });

            const msg = {
                payload: {}
            };
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should handle invalid ROI coordinates error', function(done) {
            roiExtractNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                roi: { x: -10, y: -10, width: 100, height: 100 } // Invalid negative coordinates
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                expect(err).to.exist;
                expect(err.message).to.include('ROI');
                done();
            });

            const msg = {
                payload: {
                    image_id: 'img_789'
                }
            };
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });
    });

    describe('Close handlers', function() {
        it('should clear status on template-match node close', function(done) {
            const templateMatchNode = require('../../nodes/vision/mv-template-match.js');
            templateMatchNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                templateId: 'tmpl_test'
            };
            const nodeInstance = new NodeConstructor(config);

            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            // Call async close handler with done callback
            closeHandler.call(nodeInstance, function() {
                // Verify status was cleared
                expect(node.status.calledWith({})).to.be.true;
                done();
            });
        });

        it('should clear status on edge-detect node close', function() {
            const edgeDetectNode = require('../../nodes/vision/mv-edge-detect.js');
            edgeDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                method: 'canny'
            };
            const nodeInstance = new NodeConstructor(config);

            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            // Call synchronous close handler
            closeHandler.call(nodeInstance);

            // Verify status was cleared
            expect(node.status.calledWith({})).to.be.true;
        });

        it('should clear status on color-detect node close', function() {
            const colorDetectNode = require('../../nodes/vision/mv-color-detect.js');
            colorDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                method: 'histogram'
            };
            const nodeInstance = new NodeConstructor(config);

            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            // Call synchronous close handler
            closeHandler.call(nodeInstance);

            // Verify status was cleared
            expect(node.status.calledWith({})).to.be.true;
        });

        it('should clear status on aruco-detect node close', function() {
            const arucoDetectNode = require('../../nodes/vision/mv-aruco-detect.js');
            arucoDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config'
            };
            const nodeInstance = new NodeConstructor(config);

            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            // Call synchronous close handler
            closeHandler.call(nodeInstance);

            // Verify status was cleared
            expect(node.status.calledWith({})).to.be.true;
        });

        it('should clear status on rotation-detect node close', function() {
            const rotationDetectNode = require('../../nodes/vision/mv-rotation-detect.js');
            rotationDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config'
            };
            const nodeInstance = new NodeConstructor(config);

            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            // Call synchronous close handler
            closeHandler.call(nodeInstance);

            // Verify status was cleared
            expect(node.status.calledWith({})).to.be.true;
        });

        it('should clear status on roi-extract node close', function() {
            const roiExtractNode = require('../../nodes/vision/mv-roi-extract.js');
            roiExtractNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                roiMode: 'absolute'
            };
            const nodeInstance = new NodeConstructor(config);

            const closeHandler = node.on.withArgs('close').getCall(0).args[1];

            // Call synchronous close handler
            closeHandler.call(nodeInstance);

            // Verify status was cleared
            expect(node.status.calledWith({})).to.be.true;
        });
    });

    describe('Error handling', function() {
        it('should handle API errors in template-match', function(done) {
            const templateMatchNode = require('../../nodes/vision/mv-template-match.js');
            templateMatchNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            // Mock API error
            nock('http://localhost:8000')
                .post('/api/vision/template-match', () => true)
                .reply(500, { error: 'Internal server error' });

            const config = {
                apiConfig: 'mock-api-config',
                templateId: 'tmpl_test'
            };
            const nodeInstance = new NodeConstructor(config);

            // Override node.error to capture error
            nodeInstance.error = sinon.stub().callsFake(function() {
                done();
            });

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const msg = { image_id: 'img_error' };
            inputHandler.call(nodeInstance, msg, () => {}, () => {});
        });

        it('should handle missing image_id in template-match', function(done) {
            const templateMatchNode = require('../../nodes/vision/mv-template-match.js');
            templateMatchNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                templateId: 'tmpl_test'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                expect(err).to.exist;
                expect(err.message).to.include('No image_id');
                done();
            });

            const msg = { payload: {} }; // No image_id
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should handle missing template_id in template-match', function(done) {
            const templateMatchNode = require('../../nodes/vision/mv-template-match.js');
            templateMatchNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config'
                // No templateId
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                expect(err).to.exist;
                expect(err.message).to.include('No template_id');
                done();
            });

            const msg = { image_id: 'img_123' };
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should handle missing image_id in edge-detect', function(done) {
            const edgeDetectNode = require('../../nodes/vision/mv-edge-detect.js');
            edgeDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                method: 'canny'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                expect(err).to.exist;
                expect(err.message).to.include('No image_id');
                done();
            });

            const msg = { payload: {} }; // No image_id
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should handle missing image_id in color-detect', function(done) {
            const colorDetectNode = require('../../nodes/vision/mv-color-detect.js');
            colorDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                expectedColor: 'red'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                expect(err).to.exist;
                expect(err.message).to.include('No image_id');
                done();
            });

            const msg = { payload: {} }; // No image_id
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should handle missing image_id in aruco-detect', function(done) {
            const arucoDetectNode = require('../../nodes/vision/mv-aruco-detect.js');
            arucoDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                dictionary: 'DICT_4X4_50'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                expect(err).to.exist;
                expect(err.message).to.include('No image_id');
                done();
            });

            const msg = { payload: {} }; // No image_id
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });

        it('should handle missing image_id in rotation-detect', function(done) {
            const rotationDetectNode = require('../../nodes/vision/mv-rotation-detect.js');
            rotationDetectNode(RED);
            const NodeConstructor = RED.nodes.registerType.getCall(0).args[1];

            const mockApiConfig = {
                apiUrl: 'http://localhost:8000',
                timeout: 30000
            };
            RED.nodes.getNode.returns(mockApiConfig);

            const config = {
                apiConfig: 'mock-api-config',
                method: 'min_area_rect'
            };
            const nodeInstance = new NodeConstructor(config);

            const inputHandler = node.on.withArgs('input').getCall(0).args[1];

            const mockDone = sinon.stub().callsFake(function(err) {
                expect(err).to.exist;
                expect(err.message).to.include('No image_id');
                done();
            });

            const msg = { payload: {} }; // No image_id
            inputHandler.call(nodeInstance, msg, () => {}, mockDone);
        });
    });
});
