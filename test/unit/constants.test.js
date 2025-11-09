/**
 * Unit tests for constants.js
 */

const { expect } = require('chai');
const CONSTANTS = require('../../nodes/lib/constants');

describe('constants', function() {

    describe('API', function() {
        it('should have default URL', function() {
            expect(CONSTANTS.API).to.have.property('DEFAULT_URL');
            expect(CONSTANTS.API.DEFAULT_URL).to.be.a('string');
            expect(CONSTANTS.API.DEFAULT_URL).to.include('http');
        });

        it('should have default timeout', function() {
            expect(CONSTANTS.API).to.have.property('DEFAULT_TIMEOUT');
            expect(CONSTANTS.API.DEFAULT_TIMEOUT).to.be.a('number');
            expect(CONSTANTS.API.DEFAULT_TIMEOUT).to.be.above(0);
        });

        it('should have health check timeout', function() {
            expect(CONSTANTS.API).to.have.property('HEALTH_CHECK_TIMEOUT');
            expect(CONSTANTS.API.HEALTH_CHECK_TIMEOUT).to.be.a('number');
        });
    });

    describe('RETRY', function() {
        it('should have retry configuration', function() {
            expect(CONSTANTS.RETRY).to.have.property('MAX_ATTEMPTS');
            expect(CONSTANTS.RETRY).to.have.property('DELAY_MS');
            expect(CONSTANTS.RETRY).to.have.property('EXPONENTIAL_BASE');

            expect(CONSTANTS.RETRY.MAX_ATTEMPTS).to.be.a('number');
            expect(CONSTANTS.RETRY.DELAY_MS).to.be.a('number');
            expect(CONSTANTS.RETRY.EXPONENTIAL_BASE).to.be.a('number');
        });
    });

    describe('STREAM', function() {
        it('should have stream delays', function() {
            expect(CONSTANTS.STREAM).to.have.property('START_DELAY');
            expect(CONSTANTS.STREAM).to.have.property('STOP_DELAY');
            expect(CONSTANTS.STREAM).to.have.property('RECONNECT_DELAY');
        });
    });

    describe('EDGE_DETECT', function() {
        it('should have Canny defaults', function() {
            expect(CONSTANTS.EDGE_DETECT).to.have.property('CANNY_LOW_THRESHOLD');
            expect(CONSTANTS.EDGE_DETECT).to.have.property('CANNY_HIGH_THRESHOLD');
            expect(CONSTANTS.EDGE_DETECT).to.have.property('CANNY_APERTURE');
            expect(CONSTANTS.EDGE_DETECT).to.have.property('CANNY_L2_GRADIENT');
        });

        it('should have Sobel defaults', function() {
            expect(CONSTANTS.EDGE_DETECT).to.have.property('SOBEL_THRESHOLD');
            expect(CONSTANTS.EDGE_DETECT).to.have.property('SOBEL_KSIZE');
        });

        it('should have post-processing defaults', function() {
            expect(CONSTANTS.EDGE_DETECT).to.have.property('DILATE_ITERATIONS');
            expect(CONSTANTS.EDGE_DETECT).to.have.property('ERODE_ITERATIONS');
            expect(CONSTANTS.EDGE_DETECT).to.have.property('BLUR_KERNEL_SIZE');
        });
    });

    describe('COLOR_DETECT', function() {
        it('should have color detection defaults', function() {
            expect(CONSTANTS.COLOR_DETECT).to.have.property('MIN_AREA');
            expect(CONSTANTS.COLOR_DETECT).to.have.property('USE_CONTOUR_MASK');
            expect(CONSTANTS.COLOR_DETECT).to.have.property('MAX_CONTOURS');
        });
    });

    describe('TEMPLATE_MATCH', function() {
        it('should have template matching defaults', function() {
            expect(CONSTANTS.TEMPLATE_MATCH).to.have.property('THRESHOLD');
            expect(CONSTANTS.TEMPLATE_MATCH).to.have.property('METHOD');
            expect(CONSTANTS.TEMPLATE_MATCH).to.have.property('MAX_RESULTS');

            expect(CONSTANTS.TEMPLATE_MATCH.THRESHOLD).to.be.within(0, 1);
        });
    });

    describe('ARUCO_DETECT', function() {
        it('should have ArUco defaults', function() {
            expect(CONSTANTS.ARUCO_DETECT).to.have.property('DICTIONARY');
            expect(CONSTANTS.ARUCO_DETECT).to.have.property('MARKER_LENGTH');

            expect(CONSTANTS.ARUCO_DETECT.DICTIONARY).to.be.a('string');
        });
    });

    describe('ROTATION_DETECT', function() {
        it('should have rotation detection defaults', function() {
            expect(CONSTANTS.ROTATION_DETECT).to.have.property('THRESHOLD');
            expect(CONSTANTS.ROTATION_DETECT).to.have.property('MIN_LINE_LENGTH');
            expect(CONSTANTS.ROTATION_DETECT).to.have.property('MAX_LINE_GAP');
        });
    });

    describe('ROI', function() {
        it('should have ROI defaults', function() {
            expect(CONSTANTS.ROI).to.have.property('DEFAULT_X');
            expect(CONSTANTS.ROI).to.have.property('DEFAULT_Y');
            expect(CONSTANTS.ROI).to.have.property('DEFAULT_WIDTH');
            expect(CONSTANTS.ROI).to.have.property('DEFAULT_HEIGHT');
        });

        it('should have ROI modes', function() {
            expect(CONSTANTS.ROI).to.have.property('MODE_ABSOLUTE');
            expect(CONSTANTS.ROI).to.have.property('MODE_RELATIVE');

            expect(CONSTANTS.ROI.MODE_ABSOLUTE).to.equal('absolute');
            expect(CONSTANTS.ROI.MODE_RELATIVE).to.equal('relative');
        });
    });

    describe('SIMULATOR', function() {
        it('should have simulator defaults', function() {
            expect(CONSTANTS.SIMULATOR).to.have.property('DEFAULT_TRIGGER_INTERVAL');
            expect(CONSTANTS.SIMULATOR).to.have.property('MIN_TRIGGER_INTERVAL');
            expect(CONSTANTS.SIMULATOR).to.have.property('TEST_IMAGE_SOURCE');
            expect(CONSTANTS.SIMULATOR).to.have.property('DEFAULT_TEXT');
        });

        it('should have reasonable intervals', function() {
            expect(CONSTANTS.SIMULATOR.MIN_TRIGGER_INTERVAL).to.be.below(
                CONSTANTS.SIMULATOR.DEFAULT_TRIGGER_INTERVAL
            );
        });
    });

    describe('CAMERA', function() {
        it('should have camera defaults', function() {
            expect(CONSTANTS.CAMERA).to.have.property('DEFAULT_ID');
            expect(CONSTANTS.CAMERA).to.have.property('SOURCE_TYPE_USB');
            expect(CONSTANTS.CAMERA).to.have.property('SOURCE_TYPE_IP');
            expect(CONSTANTS.CAMERA).to.have.property('SOURCE_TYPE_TEST');
        });

        it('should have string source types', function() {
            expect(CONSTANTS.CAMERA.SOURCE_TYPE_USB).to.be.a('string');
            expect(CONSTANTS.CAMERA.SOURCE_TYPE_IP).to.be.a('string');
            expect(CONSTANTS.CAMERA.SOURCE_TYPE_TEST).to.be.a('string');
        });
    });

    describe('OBJECT_TYPES', function() {
        it('should have all object types defined', function() {
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('CAMERA_CAPTURE');
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('IMAGE_IMPORT');
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('IMAGE_SIMULATOR');
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('TEMPLATE_MATCH');
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('EDGE_DETECTION');
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('COLOR_DETECTION');
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('ARUCO_MARKER');
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('ROTATION');
            expect(CONSTANTS.OBJECT_TYPES).to.have.property('ROI');
        });

        it('should be snake_case strings', function() {
            Object.values(CONSTANTS.OBJECT_TYPES).forEach(type => {
                expect(type).to.be.a('string');
                expect(type).to.match(/^[a-z_]+$/);
            });
        });
    });

    describe('STATUS_TEXT', function() {
        it('should have common status texts', function() {
            expect(CONSTANTS.STATUS_TEXT).to.have.property('READY');
            expect(CONSTANTS.STATUS_TEXT).to.have.property('PROCESSING');
            expect(CONSTANTS.STATUS_TEXT).to.have.property('ERROR');
            expect(CONSTANTS.STATUS_TEXT).to.have.property('CAPTURING');
            expect(CONSTANTS.STATUS_TEXT).to.have.property('IMPORTING');
            expect(CONSTANTS.STATUS_TEXT).to.have.property('GENERATING');
        });

        it('should have error status texts', function() {
            expect(CONSTANTS.STATUS_TEXT).to.have.property('NO_CONFIG');
            expect(CONSTANTS.STATUS_TEXT).to.have.property('NOT_FOUND');
            expect(CONSTANTS.STATUS_TEXT).to.have.property('NETWORK_ERROR');
            expect(CONSTANTS.STATUS_TEXT).to.have.property('TIMEOUT');
        });

        it('should all be strings', function() {
            Object.values(CONSTANTS.STATUS_TEXT).forEach(text => {
                expect(text).to.be.a('string');
            });
        });
    });

    describe('LIMITS', function() {
        it('should have limit values', function() {
            expect(CONSTANTS.LIMITS).to.have.property('MAX_CONTOURS');
            expect(CONSTANTS.LIMITS).to.have.property('MAX_CONTOUR_AREA');
            expect(CONSTANTS.LIMITS).to.have.property('MIN_CONTOUR_AREA');
            expect(CONSTANTS.LIMITS).to.have.property('MAX_TEMPLATE_RESULTS');
        });

        it('should have valid min/max relationships', function() {
            expect(CONSTANTS.LIMITS.MIN_CONTOUR_AREA).to.be.below(
                CONSTANTS.LIMITS.MAX_CONTOUR_AREA
            );
        });
    });
});
