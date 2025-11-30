module.exports = function(RED) {
    const {
        setNodeStatus,
        createVisionObjectMessage,
        callVisionAPI,
        getImageId,
        getTimestamp
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
        node.gaussianKernel = config.gaussianKernel || 5;

        // Median Blur
        node.medianBlurEnabled = config.medianBlurEnabled || false;
        node.medianKernel = config.medianKernel || 5;

        // Bilateral Filter
        node.bilateralEnabled = config.bilateralEnabled || false;
        node.bilateralD = config.bilateralD || 9;
        node.bilateralSigmaColor = config.bilateralSigmaColor || 75;
        node.bilateralSigmaSpace = config.bilateralSigmaSpace || 75;

        // Morphology
        node.morphologyEnabled = config.morphologyEnabled || false;
        node.morphologyOperation = config.morphologyOperation || 'close';
        node.morphologyKernel = config.morphologyKernel || 3;

        // Threshold
        node.thresholdEnabled = config.thresholdEnabled || false;
        node.thresholdMethod = config.thresholdMethod || 'binary';
        node.thresholdValue = config.thresholdValue || 127;
        node.thresholdMaxValue = config.thresholdMaxValue || 255;
        node.adaptiveBlockSize = config.adaptiveBlockSize || 11;
        node.adaptiveC = config.adaptiveC || 2;

        // Histogram Equalization
        node.histEqualizeEnabled = config.histEqualizeEnabled || false;

        // CLAHE
        node.claheEnabled = config.claheEnabled || false;
        node.claheClipLimit = config.claheClipLimit || 2.0;
        node.claheTileGridSize = config.claheTileGridSize || 8;

        // Sharpening
        node.sharpenEnabled = config.sharpenEnabled || false;
        node.sharpenStrength = config.sharpenStrength || 1.0;

        // Brightness/Contrast
        node.brightnessContrastEnabled = config.brightnessContrastEnabled || false;
        node.brightness = config.brightness || 0;
        node.contrast = config.contrast || 1.0;

        // Set initial status
        setNodeStatus(node, 'ready');

        node.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments) };
            done = done || function(err) { if(err) node.error(err, msg) };

            // Extract image_id using utility
            const imageId = getImageId(msg);
            if (!imageId) {
                node.error("No image_id provided", msg);
                setNodeStatus(node, 'error', 'missing image_id');
                return done(new Error("No image_id provided"));
            }

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
                outputMsg.node_name = node.name || "Preprocess";
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

    RED.nodes.registerType("mv-preprocess", MVPreprocessNode);
}
