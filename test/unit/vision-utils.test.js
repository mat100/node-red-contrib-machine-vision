/**
 * Unit tests for vision-utils.js
 */

const { expect } = require('chai');
const sinon = require('sinon');
const nock = require('nock');
const visionUtils = require('../../nodes/lib/vision-utils');
const CONSTANTS = require('../../nodes/lib/constants');

describe('vision-utils', function() {

    afterEach(function() {
        sinon.restore();
        nock.cleanAll();
    });

    describe('getApiSettings', function() {

        it('should extract API settings from config', function() {
            const apiConfig = {
                apiUrl: 'http://test:8000',
                timeout: 5000,
                credentials: {
                    apiKey: 'test-key',
                    apiToken: 'test-token'
                }
            };

            const result = visionUtils.getApiSettings(apiConfig);

            expect(result).to.have.property('apiUrl', 'http://test:8000');
            expect(result).to.have.property('timeout', 5000);
            expect(result).to.have.property('headers');
            expect(result.headers).to.have.property('Content-Type', 'application/json');
            expect(result.headers).to.have.property('X-API-Key', 'test-key');
            expect(result.headers).to.have.property('Authorization', 'Bearer test-token');
        });

        it('should use default values when not provided', function() {
            const apiConfig = {};

            const result = visionUtils.getApiSettings(apiConfig);

            expect(result.apiUrl).to.equal(CONSTANTS.API.DEFAULT_URL);
            expect(result.timeout).to.equal(CONSTANTS.API.DEFAULT_TIMEOUT);
        });

        it('should throw error when apiConfig is null', function() {
            expect(() => visionUtils.getApiSettings(null)).to.throw('Missing API configuration');
        });

        it('should handle missing credentials', function() {
            const apiConfig = {
                apiUrl: 'http://test:8000'
            };

            const result = visionUtils.getApiSettings(apiConfig);

            expect(result.headers).to.not.have.property('X-API-Key');
            expect(result.headers).to.not.have.property('Authorization');
        });
    });

    describe('setNodeStatus', function() {

        let mockNode;

        beforeEach(function() {
            mockNode = {
                status: sinon.stub()
            };
        });

        it('should set ready status', function() {
            visionUtils.setNodeStatus(mockNode, 'ready');

            expect(mockNode.status.calledOnce).to.be.true;
            const call = mockNode.status.getCall(0).args[0];
            expect(call).to.have.property('fill', 'grey');
            expect(call).to.have.property('shape', 'ring');
            expect(call).to.have.property('text', 'ready');
        });

        it('should set processing status with message', function() {
            visionUtils.setNodeStatus(mockNode, 'processing', 'working...');

            const call = mockNode.status.getCall(0).args[0];
            expect(call).to.have.property('fill', 'blue');
            expect(call).to.have.property('text', 'working...');
        });

        it('should set success status with processing time', function() {
            visionUtils.setNodeStatus(mockNode, 'success', 'done', 123);

            const call = mockNode.status.getCall(0).args[0];
            expect(call).to.have.property('fill', 'green');
            expect(call).to.have.property('text', 'done | 123ms');
        });

        it('should set error status with message', function() {
            visionUtils.setNodeStatus(mockNode, 'error', 'failed');

            const call = mockNode.status.getCall(0).args[0];
            expect(call).to.have.property('fill', 'red');
            expect(call).to.have.property('text', 'failed');
        });
    });

    describe('addMessageMetadata', function() {

        it('should set success and processing_time_ms', function() {
            const outputMsg = {};
            const node = { name: 'My Edge' };
            const result = { processing_time_ms: 42 };

            visionUtils.addMessageMetadata(outputMsg, node, result);

            expect(outputMsg).to.have.property('success', true);
            expect(outputMsg).to.have.property('processing_time_ms', 42);
        });

        it('should default reference to null when undefined', function() {
            const outputMsg = {};
            const node = { name: 'My Edge' };
            const result = { processing_time_ms: 10 };

            visionUtils.addMessageMetadata(outputMsg, node, result);

            expect(outputMsg).to.have.property('reference', null);
        });

        it('should default topic to null when undefined', function() {
            const outputMsg = {};
            const node = {};
            const result = { processing_time_ms: 5 };

            visionUtils.addMessageMetadata(outputMsg, node, result);

            expect(outputMsg).to.have.property('topic', null);
        });

        it('should preserve existing reference and topic', function() {
            const outputMsg = { reference: { origin: [0, 0] }, topic: 'mv/test' };
            const node = { name: 'Test' };
            const result = { processing_time_ms: 7 };

            visionUtils.addMessageMetadata(outputMsg, node, result);

            expect(outputMsg.reference).to.deep.equal({ origin: [0, 0] });
            expect(outputMsg.topic).to.equal('mv/test');
        });
    });

    describe('validateRequiredFields', function() {

        let mockNode, mockDone;

        beforeEach(function() {
            mockNode = {
                error: sinon.stub(),
                status: sinon.stub()
            };
            mockDone = sinon.stub();
        });

        it('should return true when all fields present', function() {
            const msg = {
                image_id: 'test',
                payload: {
                    data: 'value'
                }
            };

            const result = visionUtils.validateRequiredFields(
                msg, ['image_id', 'payload.data'], mockNode, mockDone
            );

            expect(result).to.be.true;
            expect(mockNode.error.called).to.be.false;
        });

        it('should return false when field missing', function() {
            const msg = {
                image_id: 'test'
            };

            const result = visionUtils.validateRequiredFields(
                msg, ['image_id', 'payload.data'], mockNode, mockDone
            );

            expect(result).to.be.false;
            expect(mockNode.error.calledOnce).to.be.true;
            expect(mockDone.calledOnce).to.be.true;
        });

        it('should handle nested paths correctly', function() {
            const msg = {
                level1: {
                    level2: {
                        level3: 'value'
                    }
                }
            };

            const result = visionUtils.validateRequiredFields(
                msg, ['level1.level2.level3'], mockNode, mockDone
            );

            expect(result).to.be.true;
        });
    });

    describe('getImageId', function() {

        it('should extract image id from msg.image.id', function() {
            const msg = { image: { id: 'test123' } };
            expect(visionUtils.getImageId(msg)).to.equal('test123');
        });

        it('should return null when image object is missing', function() {
            const msg = {};
            expect(visionUtils.getImageId(msg)).to.be.null;
        });

        it('should return null when image.id is missing', function() {
            const msg = { image: {} };
            expect(visionUtils.getImageId(msg)).to.be.null;
        });

        it('should ignore legacy root image_id', function() {
            const msg = { image_id: 'legacy123' };
            expect(visionUtils.getImageId(msg)).to.be.null;
        });
    });

    describe('getTimestamp', function() {

        it('should extract timestamp from msg.image.timestamp', function() {
            const ts = '2025-01-01T00:00:00Z';
            const msg = { image: { timestamp: ts } };
            expect(visionUtils.getTimestamp(msg)).to.equal(ts);
        });

        it('should generate new timestamp when image object is missing', function() {
            const msg = {};
            const result = visionUtils.getTimestamp(msg);
            expect(result).to.be.a('string');
            expect(new Date(result).toISOString()).to.equal(result);
        });

        it('should generate new timestamp when image.timestamp is missing', function() {
            const msg = { image: {} };
            const result = visionUtils.getTimestamp(msg);
            expect(result).to.be.a('string');
            expect(new Date(result).toISOString()).to.equal(result);
        });
    });

    describe('callCameraAPI', function() {

        const API_URL = 'http://localhost:8000';
        let mockNode, mockDone;

        beforeEach(function() {
            mockNode = {
                error: sinon.stub(),
                status: sinon.stub(),
                log: sinon.stub()
            };
            mockDone = sinon.stub();
        });

        it('should successfully call camera API', async function() {
            const apiConfig = {
                apiUrl: API_URL,
                timeout: 5000
            };

            nock(API_URL)
                .post('/api/camera/capture')
                .reply(200, {
                    success: true,
                    image_id: 'test123'
                });

            const result = await visionUtils.callCameraAPI({
                node: mockNode,
                endpoint: '/api/camera/capture',
                requestData: { camera_id: 'test' },
                apiConfig: apiConfig,
                done: mockDone
            });

            expect(result).to.have.property('success', true);
            expect(result).to.have.property('image_id', 'test123');
        });

        it('should handle API errors', async function() {
            const apiConfig = {
                apiUrl: API_URL,
                timeout: 5000
            };

            nock(API_URL)
                .post('/api/camera/capture')
                .reply(404, {
                    detail: 'Camera not found'
                });

            try {
                await visionUtils.callCameraAPI({
                    node: mockNode,
                    endpoint: '/api/camera/capture',
                    requestData: { camera_id: 'test' },
                    apiConfig: apiConfig,
                    done: mockDone
                });
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(mockNode.error.called).to.be.true;
                expect(mockDone.called).to.be.true;
                expect(error.handledByUtils).to.be.true;
            }
        });

        it('should support GET method', async function() {
            const apiConfig = {
                apiUrl: API_URL,
                timeout: 5000
            };

            nock(API_URL)
                .get('/api/system/health')
                .reply(200, { status: 'ok' });

            const result = await visionUtils.callCameraAPI({
                node: null,
                endpoint: '/api/system/health',
                method: 'GET',
                apiConfig: apiConfig
            });

            expect(result).to.have.property('status', 'ok');
        });
    });

    describe('callImageAPI', function() {

        const API_URL = 'http://localhost:8000';
        let mockNode, mockDone;

        beforeEach(function() {
            mockNode = {
                error: sinon.stub(),
                status: sinon.stub()
            };
            mockDone = sinon.stub();
        });

        it('should successfully call image API', async function() {
            const apiConfig = {
                apiUrl: API_URL,
                timeout: 5000
            };

            nock(API_URL)
                .post('/api/image/import')
                .reply(200, {
                    success: true,
                    image_id: 'imported123'
                });

            const result = await visionUtils.callImageAPI({
                node: mockNode,
                endpoint: '/api/image/import',
                requestData: { file_path: '/test.jpg' },
                apiConfig: apiConfig,
                done: mockDone
            });

            expect(result).to.have.property('success', true);
            expect(result).to.have.property('image_id', 'imported123');
        });

        it('should handle network errors', async function() {
            const apiConfig = {
                apiUrl: 'http://nonexistent:8000',
                timeout: 1000
            };

            try {
                await visionUtils.callImageAPI({
                    node: mockNode,
                    endpoint: '/api/image/import',
                    requestData: { file_path: '/test.jpg' },
                    apiConfig: apiConfig,
                    done: mockDone
                });
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(mockNode.error.called).to.be.true;
                expect(error.handledByUtils).to.be.true;
            }
        });
    });

    describe('buildEdgeDetectParams', function() {

        it('should build params with defaults', function() {
            const params = visionUtils.buildEdgeDetectParams({});

            expect(params).to.have.property('method', 'canny');
            expect(params).to.have.property('canny_low', visionUtils.CONSTANTS.EDGE_DETECT.CANNY_LOW_THRESHOLD);
            expect(params).to.have.property('canny_high', visionUtils.CONSTANTS.EDGE_DETECT.CANNY_HIGH_THRESHOLD);
            expect(params).to.have.property('sobel_threshold', visionUtils.CONSTANTS.EDGE_DETECT.SOBEL_THRESHOLD);
        });

        it('should use custom values when provided', function() {
            const params = visionUtils.buildEdgeDetectParams({
                method: 'sobel',
                cannyLow: 30,
                cannyHigh: 120,
                sobelThreshold: 75
            });

            expect(params).to.have.property('method', 'sobel');
            expect(params).to.have.property('canny_low', 30);
            expect(params).to.have.property('canny_high', 120);
            expect(params).to.have.property('sobel_threshold', 75);
        });

        it('should include contour filtering params', function() {
            const params = visionUtils.buildEdgeDetectParams({});

            expect(params).to.have.property('min_contour_area');
            expect(params).to.have.property('max_contour_area');
            expect(params).to.have.property('max_contours');
        });

        it('should parse string values to integers', function() {
            const params = visionUtils.buildEdgeDetectParams({
                cannyLow: '40',
                maxContours: '15'
            });

            expect(params.canny_low).to.equal(40);
            expect(params.max_contours).to.equal(15);
        });

        it('should use MORPH_THRESHOLD and MORPH_KERNEL from constants', function() {
            const params = visionUtils.buildEdgeDetectParams({});

            expect(params.morph_threshold).to.equal(CONSTANTS.EDGE_DETECT.MORPH_THRESHOLD);
            expect(params.morph_kernel).to.equal(CONSTANTS.EDGE_DETECT.MORPH_KERNEL);
        });
    });

    describe('callVisionAPI', function() {

        const API_URL = 'http://localhost:8000';
        let mockNode, mockDone;

        beforeEach(function() {
            mockNode = {
                error: sinon.stub(),
                status: sinon.stub(),
                log: sinon.stub()
            };
            mockDone = sinon.stub();
        });

        it('should set handledByUtils on error', async function() {
            const apiConfig = {
                apiUrl: API_URL,
                timeout: 5000
            };

            nock(API_URL)
                .post('/api/vision/edge-detect')
                .reply(500, { detail: 'Internal error' });

            try {
                await visionUtils.callVisionAPI({
                    node: mockNode,
                    endpoint: '/api/vision/edge-detect',
                    requestData: { image_id: 'test' },
                    apiConfig: apiConfig,
                    done: mockDone
                });
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.handledByUtils).to.be.true;
                expect(mockDone.calledOnce).to.be.true;
            }
        });

        it('should set handledByUtils on network error', async function() {
            const apiConfig = {
                apiUrl: 'http://nonexistent:9999',
                timeout: 1000
            };

            try {
                await visionUtils.callVisionAPI({
                    node: mockNode,
                    endpoint: '/api/vision/edge-detect',
                    requestData: { image_id: 'test' },
                    apiConfig: apiConfig,
                    done: mockDone
                });
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.handledByUtils).to.be.true;
                expect(mockDone.calledOnce).to.be.true;
            }
        });
    });

    describe('validateInput', function() {

        let mockNode, mockDone;

        beforeEach(function() {
            mockNode = {
                error: sinon.stub(),
                status: sinon.stub()
            };
            mockDone = sinon.stub();
        });

        it('should return valid with imageId when image.id is present', function() {
            const msg = { image: { id: 'test123' } };
            const result = visionUtils.validateInput(mockNode, msg, mockDone);

            expect(result.valid).to.be.true;
            expect(result.imageId).to.equal('test123');
            expect(mockDone.called).to.be.false;
        });

        it('should return invalid when image.id is missing', function() {
            const msg = {};
            const result = visionUtils.validateInput(mockNode, msg, mockDone);

            expect(result.valid).to.be.false;
            expect(mockNode.error.calledOnce).to.be.true;
            expect(mockDone.calledOnce).to.be.true;
        });

        it('should use correct error message for missing image.id', function() {
            const msg = {};
            visionUtils.validateInput(mockNode, msg, mockDone);

            expect(mockNode.error.firstCall.args[0]).to.equal('No image.id provided');
            const statusCall = mockNode.status.getCall(0).args[0];
            expect(statusCall.text).to.include('missing image.id');
        });

        it('should reject when image_id is at root level (legacy format)', function() {
            const msg = { image_id: 'legacy123' };
            const result = visionUtils.validateInput(mockNode, msg, mockDone);

            expect(result.valid).to.be.false;
        });
    });
});
