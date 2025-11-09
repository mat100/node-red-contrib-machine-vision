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

    describe('createCameraVisionObject', function() {

        it('should create valid VisionObject structure', function() {
            const imageId = 'abc123def456';
            const timestamp = '2025-01-01T00:00:00Z';
            const metadata = { width: 640, height: 480 };
            const thumbnail = 'base64data';
            const objectType = CONSTANTS.OBJECT_TYPES.CAMERA_CAPTURE;

            const result = visionUtils.createCameraVisionObject(
                imageId, timestamp, metadata, thumbnail, objectType
            );

            expect(result).to.have.property('object_id', 'img_abc123de');
            expect(result).to.have.property('object_type', objectType);
            expect(result).to.have.property('image_id', imageId);
            expect(result).to.have.property('timestamp', timestamp);
            expect(result).to.have.property('confidence', 1.0);
            expect(result).to.have.property('thumbnail', thumbnail);

            expect(result.bounding_box).to.deep.equal({
                x: 0, y: 0, width: 640, height: 480
            });

            expect(result.center).to.deep.equal({
                x: 320, y: 240
            });

            expect(result.properties).to.deep.equal({});
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

        it('should extract image_id from root', function() {
            const msg = { image_id: 'test123' };
            expect(visionUtils.getImageId(msg)).to.equal('test123');
        });

        it('should extract image_id from payload', function() {
            const msg = { payload: { image_id: 'test456' } };
            expect(visionUtils.getImageId(msg)).to.equal('test456');
        });

        it('should return null when not found', function() {
            const msg = {};
            expect(visionUtils.getImageId(msg)).to.be.null;
        });

        it('should prefer root over payload', function() {
            const msg = {
                image_id: 'root',
                payload: { image_id: 'payload' }
            };
            expect(visionUtils.getImageId(msg)).to.equal('root');
        });
    });

    describe('getTimestamp', function() {

        it('should extract timestamp from payload', function() {
            const ts = '2025-01-01T00:00:00Z';
            const msg = { payload: { timestamp: ts } };
            expect(visionUtils.getTimestamp(msg)).to.equal(ts);
        });

        it('should generate new timestamp when not found', function() {
            const msg = {};
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

        it('should include preprocessing options', function() {
            const params = visionUtils.buildEdgeDetectParams({
                blurEnabled: true,
                blurKernel: 7,
                morphologyEnabled: true,
                morphologyOperation: 'open'
            });

            expect(params).to.have.property('blur_enabled', true);
            expect(params).to.have.property('blur_kernel', 7);
            expect(params).to.have.property('morphology_enabled', true);
            expect(params).to.have.property('morphology_operation', 'open');
        });

        it('should parse string values to integers', function() {
            const params = visionUtils.buildEdgeDetectParams({
                cannyLow: '40',
                maxContours: '15'
            });

            expect(params.canny_low).to.equal(40);
            expect(params.max_contours).to.equal(15);
        });
    });
});
