/**
 * Unit tests for validation utilities
 */

const { expect } = require('chai');
const visionUtils = require('../../nodes/lib/vision-utils');

describe('Validation Utilities', function() {

    describe('validateROI', function() {

        it('should accept valid ROI', function() {
            const roi = { x: 10, y: 20, width: 100, height: 200 };
            const result = visionUtils.validateROI(roi);
            expect(result.valid).to.be.true;
        });

        it('should reject ROI with negative x', function() {
            const roi = { x: -10, y: 20, width: 100, height: 200 };
            const result = visionUtils.validateROI(roi);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('non-negative');
        });

        it('should reject ROI with negative y', function() {
            const roi = { x: 10, y: -20, width: 100, height: 200 };
            const result = visionUtils.validateROI(roi);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('non-negative');
        });

        it('should reject ROI with zero width', function() {
            const roi = { x: 10, y: 20, width: 0, height: 200 };
            const result = visionUtils.validateROI(roi);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('positive');
        });

        it('should reject ROI with negative height', function() {
            const roi = { x: 10, y: 20, width: 100, height: -200 };
            const result = visionUtils.validateROI(roi);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('positive');
        });

        it('should reject ROI with missing fields', function() {
            const roi = { x: 10, y: 20 };
            const result = visionUtils.validateROI(roi);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('width');
        });

        it('should reject non-object ROI', function() {
            const result = visionUtils.validateROI('not an object');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('must be an object');
        });

        it('should reject ROI with non-numeric values', function() {
            const roi = { x: '10', y: 20, width: 100, height: 200 };
            const result = visionUtils.validateROI(roi);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('must be numbers');
        });

        it('should enforce maxWidth option', function() {
            const roi = { x: 0, y: 0, width: 2000, height: 100 };
            const result = visionUtils.validateROI(roi, { maxWidth: 1920 });
            expect(result.valid).to.be.false;
            expect(result.error).to.include('exceeds maximum');
        });

        it('should enforce maxHeight option', function() {
            const roi = { x: 0, y: 0, width: 100, height: 2000 };
            const result = visionUtils.validateROI(roi, { maxHeight: 1080 });
            expect(result.valid).to.be.false;
            expect(result.error).to.include('exceeds maximum');
        });
    });

    describe('validateImageId', function() {

        it('should accept valid image ID', function() {
            const result = visionUtils.validateImageId('abc123-def_456');
            expect(result.valid).to.be.true;
            expect(result.sanitized).to.equal('abc123-def_456');
        });

        it('should reject image ID with path traversal', function() {
            const result = visionUtils.validateImageId('../../../etc/passwd');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('path traversal');
        });

        it('should reject image ID with forward slash', function() {
            const result = visionUtils.validateImageId('path/to/file');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('path traversal');
        });

        it('should reject image ID with backslash', function() {
            const result = visionUtils.validateImageId('path\\to\\file');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('path traversal');
        });

        it('should reject image ID with special characters', function() {
            const result = visionUtils.validateImageId('test@image!.jpg');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('alphanumeric');
        });

        it('should reject empty string', function() {
            const result = visionUtils.validateImageId('');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('non-empty string');
        });

        it('should reject null', function() {
            const result = visionUtils.validateImageId(null);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('non-empty string');
        });

        it('should reject too long image ID', function() {
            const longId = 'a'.repeat(256);
            const result = visionUtils.validateImageId(longId);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('255 characters');
        });
    });

    describe('validateNumericRange', function() {

        it('should accept value within range', function() {
            const result = visionUtils.validateNumericRange(50, 0, 100, 'test');
            expect(result.valid).to.be.true;
        });

        it('should accept min boundary', function() {
            const result = visionUtils.validateNumericRange(0, 0, 100, 'test');
            expect(result.valid).to.be.true;
        });

        it('should accept max boundary', function() {
            const result = visionUtils.validateNumericRange(100, 0, 100, 'test');
            expect(result.valid).to.be.true;
        });

        it('should reject value below min', function() {
            const result = visionUtils.validateNumericRange(-1, 0, 100, 'test');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('between 0 and 100');
        });

        it('should reject value above max', function() {
            const result = visionUtils.validateNumericRange(101, 0, 100, 'test');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('between 0 and 100');
        });

        it('should reject non-numeric value', function() {
            const result = visionUtils.validateNumericRange('50', 0, 100, 'test');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('valid number');
        });

        it('should reject NaN', function() {
            const result = visionUtils.validateNumericRange(NaN, 0, 100, 'test');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('valid number');
        });

        it('should use field name in error message', function() {
            const result = visionUtils.validateNumericRange(101, 0, 100, 'brightness');
            expect(result.valid).to.be.false;
            expect(result.error).to.include('brightness');
        });
    });

    describe('validateThreshold', function() {

        it('should accept threshold in valid range', function() {
            const result = visionUtils.validateThreshold(0.5);
            expect(result.valid).to.be.true;
        });

        it('should accept 0', function() {
            const result = visionUtils.validateThreshold(0);
            expect(result.valid).to.be.true;
        });

        it('should accept 1', function() {
            const result = visionUtils.validateThreshold(1);
            expect(result.valid).to.be.true;
        });

        it('should reject negative threshold', function() {
            const result = visionUtils.validateThreshold(-0.1);
            expect(result.valid).to.be.false;
        });

        it('should reject threshold > 1', function() {
            const result = visionUtils.validateThreshold(1.5);
            expect(result.valid).to.be.false;
        });
    });
});

describe('Security Utilities', function() {

    describe('sanitizeErrorForProduction', function() {

        it('should return original message in development', function() {
            const msg = 'Detailed error: connection to http://localhost:8000 failed';
            const result = visionUtils.sanitizeErrorForProduction(msg, true);
            expect(result).to.equal(msg);
        });

        it('should sanitize network errors in production', function() {
            const msg = 'Network error: Cannot reach API at http://localhost:8000';
            const result = visionUtils.sanitizeErrorForProduction(msg, false);
            expect(result).to.equal('Unable to connect to backend service');
            expect(result).to.not.include('localhost');
        });

        it('should sanitize authentication errors', function() {
            const msg = 'Authentication error: Invalid API key abc123';
            const result = visionUtils.sanitizeErrorForProduction(msg, false);
            expect(result).to.equal('Authentication failed');
            expect(result).to.not.include('abc123');
        });

        it('should sanitize 404 errors', function() {
            const msg = 'Not found: /internal/path/to/resource';
            const result = visionUtils.sanitizeErrorForProduction(msg, false);
            expect(result).to.equal('Requested resource not found');
            expect(result).to.not.include('internal');
        });

        it('should sanitize 500 errors', function() {
            const msg = 'Server error: Database connection failed at db.internal.com';
            const result = visionUtils.sanitizeErrorForProduction(msg, false);
            expect(result).to.equal('Internal server error occurred');
            expect(result).to.not.include('Database');
        });

        it('should use generic message for unknown errors', function() {
            const msg = 'Some unexpected error occurred';
            const result = visionUtils.sanitizeErrorForProduction(msg, false);
            expect(result).to.equal('An error occurred. Check logs for details.');
        });
    });
});

describe('Logging Utilities', function() {

    describe('debugLog', function() {

        beforeEach(function() {
            delete process.env.MV_DEBUG;
        });

        afterEach(function() {
            delete process.env.MV_DEBUG;
        });

        it('should not log when MV_DEBUG is not set', function() {
            const mockNode = {
                name: 'test-node',
                log: function() {
                    throw new Error('Should not be called');
                }
            };

            // Should not throw
            visionUtils.debugLog(mockNode, 'test', 'message', {});
        });

        it('should log when MV_DEBUG is true', function() {
            process.env.MV_DEBUG = 'true';
            let logged = false;

            const mockNode = {
                name: 'test-node',
                log: function(msg) {
                    logged = true;
                    const data = JSON.parse(msg);
                    expect(data).to.have.property('timestamp');
                    expect(data).to.have.property('category', 'test');
                    expect(data).to.have.property('message', 'test message');
                    expect(data).to.have.property('node', 'test-node');
                }
            };

            visionUtils.debugLog(mockNode, 'test', 'test message', { key: 'value' });
            expect(logged).to.be.true;
        });
    });
});

describe('Rate Limiting', function() {

    beforeEach(function() {
        // Clear all rate limiters before each test
        visionUtils.clearRateLimit('test-key');
    });

    describe('checkRateLimit', function() {

        it('should allow first request', function() {
            const allowed = visionUtils.checkRateLimit('test-key', 5, 1000);
            expect(allowed).to.be.true;
        });

        it('should allow requests up to limit', function() {
            for (let i = 0; i < 5; i++) {
                const allowed = visionUtils.checkRateLimit('test-key', 5, 1000);
                expect(allowed).to.be.true;
            }
        });

        it('should block requests over limit', function() {
            // Use up the limit
            for (let i = 0; i < 5; i++) {
                visionUtils.checkRateLimit('test-key', 5, 1000);
            }

            // Next request should be blocked
            const allowed = visionUtils.checkRateLimit('test-key', 5, 1000);
            expect(allowed).to.be.false;
        });

        it('should reset after window expires', function(done) {
            // Use up the limit
            for (let i = 0; i < 3; i++) {
                visionUtils.checkRateLimit('test-key', 3, 100);
            }

            // Should be blocked
            expect(visionUtils.checkRateLimit('test-key', 3, 100)).to.be.false;

            // Wait for window to expire
            setTimeout(() => {
                // Should be allowed again
                expect(visionUtils.checkRateLimit('test-key', 3, 100)).to.be.true;
                done();
            }, 150);
        });

        it('should handle different keys independently', function() {
            // Use up limit for key1
            for (let i = 0; i < 5; i++) {
                visionUtils.checkRateLimit('key1', 5, 1000);
            }

            // key2 should still be allowed
            const allowed = visionUtils.checkRateLimit('key2', 5, 1000);
            expect(allowed).to.be.true;
        });
    });

    describe('clearRateLimit', function() {

        it('should clear rate limiter for specific key', function() {
            // Use up the limit
            for (let i = 0; i < 5; i++) {
                visionUtils.checkRateLimit('test-key', 5, 1000);
            }

            // Should be blocked
            expect(visionUtils.checkRateLimit('test-key', 5, 1000)).to.be.false;

            // Clear the limiter
            visionUtils.clearRateLimit('test-key');

            // Should be allowed again
            expect(visionUtils.checkRateLimit('test-key', 5, 1000)).to.be.true;
        });
    });
});
