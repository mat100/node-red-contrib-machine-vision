module.exports = function(RED) {
    const {
        setNodeStatus,
        createVisionObjectMessage,
        callVisionAPI,
        getTimestamp,
        validateInput,
        CONSTANTS
    } = require('../lib/vision-utils');

    function MVPreprocessNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Grayscale
        node.grayscaleEnabled = config.grayscaleEnabled || false;

        // Gaussian Blur
        node.gaussianBlurEnabled = config.gaussianBlurEnabled || false;
        node.gaussianKernel = config.gaussianKernel || CONSTANTS.PREPROCESS.GAUSSIAN_KERNEL;

        // Median Blur
        node.medianBlurEnabled = config.medianBlurEnabled || false;
        node.medianKernel = config.medianKernel || CONSTANTS.PREPROCESS.MEDIAN_KERNEL;

        // Bilateral Filter
        node.bilateralEnabled = config.bilateralEnabled || false;
        node.bilateralD = config.bilateralD || CONSTANTS.PREPROCESS.BILATERAL_D;
        node.bilateralSigmaColor = config.bilateralSigmaColor || CONSTANTS.PREPROCESS.BILATERAL_SIGMA_COLOR;
        node.bilateralSigmaSpace = config.bilateralSigmaSpace || CONSTANTS.PREPROCESS.BILATERAL_SIGMA_SPACE;

        // Morphology
        node.morphologyEnabled = config.morphologyEnabled || false;
        node.morphologyOperation = config.morphologyOperation || 'close';
        node.morphologyKernel = config.morphologyKernel || CONSTANTS.PREPROCESS.MORPHOLOGY_KERNEL;

        // Threshold
        node.thresholdEnabled = config.thresholdEnabled || false;
        node.thresholdMethod = config.thresholdMethod || 'binary';
        node.thresholdValue = config.thresholdValue || CONSTANTS.PREPROCESS.THRESHOLD_VALUE;
        node.thresholdMaxValue = config.thresholdMaxValue || CONSTANTS.PREPROCESS.THRESHOLD_MAX;
        node.adaptiveBlockSize = config.adaptiveBlockSize || CONSTANTS.PREPROCESS.ADAPTIVE_BLOCK_SIZE;
        node.adaptiveC = config.adaptiveC || CONSTANTS.PREPROCESS.ADAPTIVE_C;

        // Histogram Equalization
        node.histEqualizeEnabled = config.histEqualizeEnabled || false;

        // CLAHE
        node.claheEnabled = config.claheEnabled || false;
        node.claheClipLimit = config.claheClipLimit || CONSTANTS.PREPROCESS.CLAHE_CLIP_LIMIT;
        node.claheTileGridSize = config.claheTileGridSize || CONSTANTS.PREPROCESS.CLAHE_TILE_GRID_SIZE;

        // Sharpening
        node.sharpenEnabled = config.sharpenEnabled || false;
        node.sharpenStrength = config.sharpenStrength || CONSTANTS.PREPROCESS.SHARPEN_STRENGTH;

        // Brightness/Contrast
        node.brightnessContrastEnabled = config.brightnessContrastEnabled || false;
        node.brightness = config.brightness || CONSTANTS.PREPROCESS.BRIGHTNESS;
        node.contrast = config.contrast || CONSTANTS.PREPROCESS.CONTRAST;

        // Set initial status
        setNodeStatus(node, 'ready');

        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if(err) node.error(err, msg); };

            const { valid, imageId } = validateInput(node, msg, done);
            if (!valid) return;

            // Publish input image_id for live preview in editor
            RED.comms.publish('mv-preprocess-preview', {
                id: node.id,
                lastImageId: imageId
            });

            // Build preprocessing parameters
            const params = {
                // Grayscale
                grayscale_enabled: node.grayscaleEnabled,

                // Gaussian Blur
                gaussian_blur_enabled: node.gaussianBlurEnabled,
                gaussian_kernel: parseInt(node.gaussianKernel),

                // Median Blur
                median_blur_enabled: node.medianBlurEnabled,
                median_kernel: parseInt(node.medianKernel),

                // Bilateral Filter
                bilateral_enabled: node.bilateralEnabled,
                bilateral_d: parseInt(node.bilateralD),
                bilateral_sigma_color: parseFloat(node.bilateralSigmaColor),
                bilateral_sigma_space: parseFloat(node.bilateralSigmaSpace),

                // Morphology
                morphology_enabled: node.morphologyEnabled,
                morphology_operation: node.morphologyOperation,
                morphology_kernel: parseInt(node.morphologyKernel),

                // Threshold
                threshold_enabled: node.thresholdEnabled,
                threshold_method: node.thresholdMethod,
                threshold_value: parseInt(node.thresholdValue),
                threshold_max_value: parseInt(node.thresholdMaxValue),
                adaptive_block_size: parseInt(node.adaptiveBlockSize),
                adaptive_c: parseFloat(node.adaptiveC),

                // Histogram Equalization
                hist_equalize_enabled: node.histEqualizeEnabled,

                // CLAHE
                clahe_enabled: node.claheEnabled,
                clahe_clip_limit: parseFloat(node.claheClipLimit),
                clahe_tile_grid_size: parseInt(node.claheTileGridSize),

                // Sharpening
                sharpen_enabled: node.sharpenEnabled,
                sharpen_strength: parseFloat(node.sharpenStrength),

                // Brightness/Contrast
                brightness_contrast_enabled: node.brightnessContrastEnabled,
                brightness: parseInt(node.brightness),
                contrast: parseFloat(node.contrast)
            };

            // Prepare request - map bounding_box from previous detection to roi parameter
            const requestData = {
                image_id: imageId,
                roi: msg.payload?.bounding_box || null,
                params: params
            };

            try {
                // Call API with unified error handling
                const result = await callVisionAPI({
                    node: node,
                    endpoint: '/api/vision/preprocess',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                // Should always return 1 object (the preprocessed image)
                if (!result.objects || result.objects.length === 0) {
                    setNodeStatus(node, 'error', 'no result');
                    done(new Error('No preprocessed image returned'));
                    return;
                }

                const obj = result.objects[0];
                const timestamp = getTimestamp(msg);

                // Use utility to create standardized VisionObject message
                const outputMsg = createVisionObjectMessage(
                    obj,
                    obj.properties.image_id,  // Use new preprocessed image_id
                    timestamp,
                    result.thumbnail_base64,
                    msg,
                    RED
                );

                // Add preprocessing-specific metadata
                outputMsg.success = true;
                outputMsg.processing_time_ms = result.processing_time_ms;
                outputMsg.node_name = node.name || 'Preprocess';
                outputMsg.image_id = obj.properties.image_id;  // New image ID for downstream nodes
                outputMsg.source_image_id = obj.properties.source_image_id;  // Original image ID

                // Add operations applied to payload
                outputMsg.payload.operations_applied = obj.properties.operations_applied || [];

                send(outputMsg);

                // Update status with operations count
                const opsCount = obj.properties.operations_applied?.length || 0;
                const statusMsg = opsCount > 0
                    ? `${opsCount} op${opsCount > 1 ? 's' : ''}`
                    : 'no ops';
                setNodeStatus(node, 'success', statusMsg, result.processing_time_ms);

                done();

            } catch (error) {
                // Error already handled by callVisionAPI
                if (!error.handledByUtils) {
                    done(error);
                }
            }
        });

        node.on('close', function() {
            node.status({});
        });
    }

    RED.nodes.registerType('mv-preprocess', MVPreprocessNode);
};
