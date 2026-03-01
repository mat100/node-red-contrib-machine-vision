module.exports = function(RED) {
    const {
        setNodeStatus,
        createVisionObjectMessage,
        addMessageMetadata,
        callVisionAPI,
        validateInput,
        CONSTANTS
    } = require('../lib/vision-utils');

    function MVTemplateMatchNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get API configuration node
        node.apiConfig = RED.nodes.getNode(config.apiConfig);

        // Configuration
        node.templateId = config.templateId;
        node.templateSource = config.templateSource || CONSTANTS.TEMPLATE_MATCH.DEFAULT_SOURCE;
        node.threshold = parseFloat(config.threshold) || CONSTANTS.TEMPLATE_MATCH.THRESHOLD;
        node.method = config.method || CONSTANTS.TEMPLATE_MATCH.METHOD;
        node.multiScale = config.multiScale || CONSTANTS.TEMPLATE_MATCH.MULTI_SCALE;
        node.scaleRange = config.scaleRange || CONSTANTS.TEMPLATE_MATCH.DEFAULT_SCALE_RANGE;

        // Set initial status
        setNodeStatus(node, 'ready');

        // Process input
        node.on('input', async function(msg, send, done) {
            // For Node-RED 1.0+ compatibility
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if(err) node.error(err, msg); };

            const { valid, imageId } = validateInput(node, msg, done);
            if (!valid) return;

            // Get template ID
            const templateId = msg.templateId || node.templateId;
            if (!templateId) {
                setNodeStatus(node, 'error', 'missing template');
                return done(new Error('No template_id configured'));
            }

            // Prepare request
            // Map bbox from previous detection to roi parameter (INPUT constraint)
            const requestData = {
                image_id: imageId,
                roi: msg.payload?.bbox || null,  // Use bbox from VisionObject as roi constraint
                params: {
                    template_id: templateId,
                    method: node.method,
                    threshold: node.threshold,
                    multi_scale: node.multiScale,
                    scale_range: node.scaleRange
                }
            };

            try {
                // Call API with unified error handling
                const result = await callVisionAPI({
                    node: node,
                    endpoint: '/api/vision/template-match',
                    requestData: requestData,
                    apiConfig: node.apiConfig,
                    done: done
                });

                // 0 objects = send nothing
                if (!result.objects || result.objects.length === 0) {
                    setNodeStatus(node, 'no_results', 'not found', result.processing_time_ms);
                    done();
                    return;
                }

                // Send N messages for N objects using utility function
                for (let i = 0; i < result.objects.length; i++) {
                    const obj = result.objects[i];

                    // Use utility to create standardized VisionObject message
                    const outputMsg = createVisionObjectMessage(
                        obj,
                        msg.image,
                        result.thumbnail,
                        msg,
                        RED
                    );

                    // Add metadata in root
                    addMessageMetadata(outputMsg, node, result);

                    send(outputMsg);
                }

                // Update status with count
                const countMsg = `${result.objects.length} match${result.objects.length > 1 ? 'es' : ''}`;
                setNodeStatus(node, 'success', countMsg, result.processing_time_ms);

                done();

            } catch (error) {
                // Error already handled by callVisionAPI
                // Just ensure done is called (may have been called already)
                if (!error.handledByUtils) {
                    done(error);
                }
            }
        });

        // Clean up
        node.on('close', function(done) {
            node.status({});
            done();
        });
    }

    RED.nodes.registerType('mv-template-match', MVTemplateMatchNode);

    // HTTP endpoint for uploading template from editor
    // Use multer for handling multipart/form-data
    // Only register if httpAdmin is available (not in test environment)
    if (RED.httpAdmin) {
        const multer = require('multer');
        const upload = multer({ dest: '/tmp/' });

        RED.httpAdmin.post('/mv-template/upload', upload.single('templateFile'), async function(req, res) {
            // Get API config from query parameter
            const apiConfigId = req.query.apiConfigId;
            if (!apiConfigId) {
                return res.status(400).json({ error: 'Missing API config ID' });
            }

            const apiConfig = RED.nodes.getNode(apiConfigId);
            if (!apiConfig) {
                return res.status(400).json({ error: 'Invalid API config' });
            }

            const templateName = req.file
                ? (req.body.name || req.file.originalname.replace(/\.[^/.]+$/, ''))
                : '';

            await require('../lib/vision-utils').handleFileUpload(req, res, {
                backendEndpoint: '/api/template/upload',
                apiConfig: apiConfig,
                additionalFormFields: {
                    name: templateName,
                    description: ''
                },
                transformResponse: (data) => ({
                    success: data.success,
                    template_id: data.template_id,
                    name: data.name,
                    size: data.size
                })
            });
        });
    }
};
