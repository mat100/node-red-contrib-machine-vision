/**
 * Machine Vision Constants
 *
 * Centralized configuration values and defaults to eliminate magic numbers
 * throughout the codebase.
 */

/**
 * API Configuration Defaults
 */
const API = {
    DEFAULT_URL: 'http://localhost:8000',
    DEFAULT_TIMEOUT: 30000,  // 30 seconds
    HEALTH_CHECK_TIMEOUT: 1000,  // 1 second for health checks
};

/**
 * Retry Configuration
 */
const RETRY = {
    MAX_ATTEMPTS: 5,
    DELAY_MS: 2000,  // 2 seconds between retries
    EXPONENTIAL_BASE: 1.5,  // For exponential backoff
};

/**
 * Stream Configuration
 */
const STREAM = {
    START_DELAY: 1000,  // Delay before starting stream
    STOP_DELAY: 500,    // Delay when stopping stream
    RECONNECT_DELAY: 300,  // Delay before reconnecting
};

/**
 * Edge Detection Defaults
 */
const EDGE_DETECT = {
    // Canny method defaults
    CANNY_LOW_THRESHOLD: 50,
    CANNY_HIGH_THRESHOLD: 150,
    CANNY_APERTURE: 3,
    CANNY_L2_GRADIENT: false,

    // Sobel method defaults
    SOBEL_THRESHOLD: 50,
    SOBEL_KSIZE: 3,
    SOBEL_SCALE: 1.0,
    SOBEL_DELTA: 0.0,

    // Laplacian method defaults
    LAPLACIAN_THRESHOLD: 50,
    LAPLACIAN_KSIZE: 3,
    LAPLACIAN_SCALE: 1.0,
    LAPLACIAN_DELTA: 0.0,

    // Prewitt method defaults
    PREWITT_THRESHOLD: 50,

    // Scharr method defaults
    SCHARR_THRESHOLD: 50,
    SCHARR_SCALE: 1.0,
    SCHARR_DELTA: 0.0,

    // Post-processing defaults
    DILATE_ITERATIONS: 0,
    ERODE_ITERATIONS: 0,
    BLUR_KERNEL_SIZE: 0,
};

/**
 * Color Detection Defaults
 */
const COLOR_DETECT = {
    MIN_AREA: 10,
    USE_CONTOUR_MASK: true,
    MAX_CONTOURS: 20,
    DEFAULT_MIN_PERCENTAGE: 50.0,
    DEFAULT_METHOD: 'histogram',
};

/**
 * Template Matching Defaults
 */
const TEMPLATE_MATCH = {
    THRESHOLD: 0.8,
    METHOD: 'TM_CCOEFF_NORMED',
    MAX_RESULTS: 10,
    DEFAULT_SCALE_RANGE: [0.8, 1.2],
    MULTI_SCALE: false,
    DEFAULT_SOURCE: 'library',
};

/**
 * ArUco Detection Defaults
 */
const ARUCO_DETECT = {
    DICTIONARY: 'DICT_4X4_50',
    MARKER_LENGTH: 0.05,  // meters
};

/**
 * Rotation Detection Defaults
 */
const ROTATION_DETECT = {
    THRESHOLD: 100,
    MIN_LINE_LENGTH: 50,
    MAX_LINE_GAP: 10,
    DEFAULT_METHOD: 'min_area_rect',
    DEFAULT_ANGLE_RANGE: '0_360',
};

/**
 * ROI Defaults
 */
const ROI = {
    DEFAULT_X: 0,
    DEFAULT_Y: 0,
    DEFAULT_WIDTH: 100,
    DEFAULT_HEIGHT: 100,
    MODE_ABSOLUTE: 'absolute',
    MODE_RELATIVE: 'relative',
};

/**
 * Image Simulator Defaults
 */
const SIMULATOR = {
    DEFAULT_TRIGGER_INTERVAL: 5000,  // 5 seconds
    MIN_TRIGGER_INTERVAL: 100,  // 100ms minimum to prevent overwhelming backend
    TEST_IMAGE_SOURCE: 'test',
    DEFAULT_TEXT: 'Test Image',
};

/**
 * Camera Defaults
 */
const CAMERA = {
    DEFAULT_ID: 'test',
    SOURCE_TYPE_USB: 'usb',
    SOURCE_TYPE_IP: 'ip',
    SOURCE_TYPE_TEST: 'test',
};

/**
 * Object Types (for VisionObject.object_type)
 */
const OBJECT_TYPES = {
    CAMERA_CAPTURE: 'camera_capture',
    IMAGE_IMPORT: 'image_import',
    IMAGE_SIMULATOR: 'image_simulator',
    TEMPLATE_MATCH: 'template_match',
    EDGE_DETECTION: 'edge_detection',
    COLOR_DETECTION: 'color_detection',
    ARUCO_MARKER: 'aruco_marker',
    ROTATION: 'rotation',
    ROI: 'roi',
};

/**
 * Status Text Constants
 */
const STATUS_TEXT = {
    READY: 'ready',
    PROCESSING: 'processing...',
    CAPTURING: 'capturing...',
    IMPORTING: 'importing...',
    GENERATING: 'generating...',
    EXTRACTING_ROI: 'extracting ROI...',
    CONNECTING: 'connecting...',
    CONNECTED: 'connected',
    STOPPED: 'stopped',
    ERROR: 'error',
    NO_CONFIG: 'no config',
    NO_RESULTS: 'no results',
    NOT_FOUND: 'not found',
    INVALID_REQUEST: 'invalid request',
    AUTH_ERROR: 'auth error',
    SERVER_ERROR: 'server error',
    NETWORK_ERROR: 'network error',
    TIMEOUT: 'timeout',
};

/**
 * Limits and Constraints
 */
const LIMITS = {
    MAX_CONTOURS: 20,
    MAX_CONTOUR_AREA: 100000,
    MIN_CONTOUR_AREA: 10,
    MAX_TEMPLATE_RESULTS: 10,
};

module.exports = {
    API,
    RETRY,
    STREAM,
    EDGE_DETECT,
    COLOR_DETECT,
    TEMPLATE_MATCH,
    ARUCO_DETECT,
    ROTATION_DETECT,
    ROI,
    SIMULATOR,
    CAMERA,
    OBJECT_TYPES,
    STATUS_TEXT,
    LIMITS,
};
