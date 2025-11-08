# node-red-contrib-machine-vision-flow

Machine Vision nodes for Node-RED, providing industrial-grade computer vision capabilities inspired by Keyence and Cognex platforms.

## Features

- **Camera Capture**: USB/IP camera support with configurable resolution and FPS
- **Image Simulation**: Test image generation with ArUco markers
- **Template Matching**: Find patterns in images with configurable thresholds
- **Edge Detection**: Multiple edge detection algorithms (Canny, Sobel, Laplacian, Prewitt, Scharr)
- **Color Detection**: HSV-based color range detection with 11 predefined colors
- **ArUco Detection**: Detect and decode ArUco markers with rotation analysis
- **Rotation Detection**: Analyze object rotation using PCA, MinAreaRect, or Moments
- **ROI Extraction**: Extract regions of interest for focused processing
- **Live Preview**: Real-time camera preview with overlay visualization
- **Overlay Rendering**: Visualize detection results on images

## Installation

### Via Node-RED Palette Manager

1. Open Node-RED
2. Go to Menu → Manage palette → Install
3. Search for `node-red-contrib-machine-vision-flow`
4. Click Install

### Via npm

```bash
cd ~/.node-red
npm install node-red-contrib-machine-vision-flow
```

### Via Local Package

If you have the `.tgz` file:

1. Open Node-RED
2. Go to Menu → Manage palette → Install
3. Switch to "Upload" tab
4. Select the `.tgz` file
5. Click Install

Or via command line:

```bash
cd ~/.node-red
npm install /path/to/node-red-contrib-machine-vision-flow-1.0.0.tgz
```

## Prerequisites

This package requires:
1. **Node-RED** installed and running
2. **Machine Vision Flow Python backend** running on `http://localhost:8000`

The backend provides REST API endpoints for computer vision processing (template matching, edge detection, color detection, ArUco detection, etc.).

### Backend Setup

The Python backend is located in a separate directory within the project structure:

```bash
# Navigate to the backend directory
cd ../backend

# Install and start the backend
make install
make start

# Backend will start on http://localhost:8000
# Verify with: curl http://localhost:8000/api/system/health
```

See `../backend/README.md` for detailed backend installation and configuration instructions.

## Development Setup

### Local Development

```bash
# 1. Install dependencies in the package directory
cd /path/to/nodered
npm install

# 2. Link to your Node-RED installation
cd ~/.node-red
npm install /path/to/nodered

# 3. Restart Node-RED to load the custom nodes
node-red-restart
# or: node-red-stop && node-red-start
```

### Uninstalling

```bash
# Uninstall from Node-RED
cd ~/.node-red
npm uninstall node-red-contrib-machine-vision-flow

# Restart Node-RED
node-red-restart
```

## Node Catalog

### Camera Nodes

#### mv-camera-capture
Capture images from USB/IP cameras or test image sources.

**Configuration:**
- Camera source (USB, IP, Test)
- Resolution (640x480 - 1920x1080)
- FPS (5-60)
- Timeout (1-30 seconds)

**Outputs:**
- `msg.image_id`: Unique image identifier
- `msg.payload`: Capture metadata (timestamp, resolution)

#### mv-image-simulator
Generate test images with ArUco markers for development.

**Configuration:**
- Image size (width x height)
- Number of ArUco markers
- Marker size
- ArUco dictionary

**Outputs:**
- `msg.image_id`: Generated test image ID
- `msg.payload`: Image metadata

#### mv-live-preview
Real-time camera preview with overlay visualization.

**Inputs:**
- `msg.image_id`: Image to display
- `msg.payload.thumbnail_base64`: Optional overlay image

**Configuration:**
- Preview quality (10-100%)
- Refresh rate

### Vision Processing Nodes

#### mv-template-match
Find template patterns in images using normalized cross-correlation.

**Configuration:**
- Template ID (learned template)
- Confidence threshold (0.0-1.0)
- Max matches (1-100)
- ROI (optional)

**Inputs:**
- `msg.image_id`: Image to search

**Outputs:**
- `msg.payload.objects[]`: Matched objects with confidence and coordinates
- `msg.payload.thumbnail_base64`: Annotated image
- `msg.payload.processing_time_ms`: Processing duration

#### mv-edge-detect
Detect edges using multiple algorithms.

**Configuration:**
- Method: Canny, Sobel, Laplacian, Prewitt, Scharr
- Threshold values (method-specific)
- Blur size (optional preprocessing)
- Min/max contour area

**Inputs:**
- `msg.image_id`: Input image

**Outputs:**
- `msg.payload.objects[]`: Detected edge contours
- `msg.payload.thumbnail_base64`: Edge visualization

#### mv-color-detect
Detect color regions using HSV color space.

**Configuration:**
- Color selection (Red, Green, Blue, Yellow, Orange, Purple, Cyan, Magenta, Black, White, Brown)
- Custom HSV ranges (optional)
- Minimum area threshold

**Inputs:**
- `msg.image_id`: Input image
- `msg.roi`: Optional region of interest

**Outputs:**
- `msg.payload.objects[0].properties.dominant_color`: Detected color name
- `msg.payload.objects[0].confidence`: Color match percentage
- `msg.payload.objects[0].properties.match`: Boolean match result

#### mv-aruco-detect
Detect and decode ArUco markers.

**Configuration:**
- ArUco dictionary (4x4_50, 5x5_100, 6x6_250, 7x7_1000, etc.)
- Corner refinement method
- Detector parameters

**Inputs:**
- `msg.image_id`: Input image

**Outputs:**
- `msg.payload.objects[]`: Detected markers with IDs
- `msg.payload.objects[].properties.marker_id`: Marker ID
- `msg.payload.objects[].properties.corners`: Corner coordinates
- `msg.payload.objects[].rotation`: Marker rotation angle

#### mv-rotation-detect
Analyze object rotation using computer vision algorithms.

**Configuration:**
- Method: PCA (Principal Component Analysis), MinAreaRect, Moments
- Edge detection preprocessing (optional)
- Contour filtering

**Inputs:**
- `msg.image_id`: Input image
- `msg.roi`: Region of interest

**Outputs:**
- `msg.payload.objects[0].rotation`: Rotation angle in degrees
- `msg.payload.objects[0].center`: Object center point

#### mv-roi-extract
Extract regions of interest for focused processing.

**Configuration:**
- ROI coordinates (x, y, width, height)
- Named ROI presets (optional)

**Inputs:**
- `msg.image_id`: Source image
- `msg.roi`: Dynamic ROI coordinates

**Outputs:**
- `msg.image_id`: Extracted ROI image ID
- `msg.roi`: Applied ROI coordinates

### Output Nodes

#### mv-overlay
Render detection results as overlay visualizations.

**Configuration:**
- Overlay type: Bounding boxes, contours, labels
- Line thickness
- Show confidence scores
- Show center points

**Inputs:**
- `msg.image_id`: Original image
- `msg.payload.objects[]`: Detection results

**Outputs:**
- `msg.payload.thumbnail_base64`: Annotated image

## Example Flows

### Basic Template Matching

```
[mv-camera-capture] → [mv-template-match] → [mv-overlay] → [mv-live-preview]
```

### Color Inspection with ROI

```
[mv-camera-capture] → [mv-roi-extract] → [mv-color-detect] → [decision logic]
                                                             ↓
                                                    [pass/fail output]
```

### ArUco Marker Tracking

```
[mv-camera-capture] → [mv-aruco-detect] → [process marker IDs] → [database]
                             ↓
                    [mv-live-preview]
```

### Rotation Measurement

```
[mv-camera-capture] → [mv-edge-detect] → [mv-rotation-detect] → [angle output]
```

## Configuration

### Backend Configuration (mv-config node)

**Recommended:** All Machine Vision nodes use a centralized **mv-config** configuration node for backend connectivity.

#### Setup Steps:

1. **Add mv-config node to your workspace:**
   - Open the Node-RED palette
   - Find `mv-config` in the "config" section
   - Drag it to your workspace (config nodes appear in the sidebar)

2. **Configure the backend connection:**
   - Double-click any MV node (e.g., mv-camera-capture)
   - In the "API Config" dropdown, select "Add new mv-config..."
   - Enter the backend URL (default: `http://localhost:8000`)
   - Set timeout (default: 30000ms)
   - Optionally add API credentials (for future authentication)
   - Click "Test Connection" to verify backend is accessible
   - Click "Add" to save

3. **Reuse across all nodes:**
   - Once created, the same mv-config appears in all MV nodes
   - Select it from the dropdown - no need to create multiple configs
   - All nodes automatically use the shared configuration

#### Configuration Properties:

- **Name:** Optional label (e.g., "Local Dev", "Production")
- **API URL:** Backend URL (format: `http://hostname:port`)
- **Timeout:** Request timeout in milliseconds (100-120000)
- **API Key:** Optional API key for authentication
- **API Token:** Optional bearer token for authentication

#### Benefits:

- ✓ **Single point of change:** Update backend URL once, all nodes update
- ✓ **Environment switching:** Easily switch between dev/staging/prod
- ✓ **Connection testing:** Built-in "Test Connection" validates backend
- ✓ **Live status:** Config node shows ✓ (connected) or ✗ (offline) in label
- ✓ **Credentials support:** Ready for future authentication requirements

### Alternative: Environment Variable

You can also set the backend URL via environment variable (legacy method):

```bash
export VISION_BACKEND_URL=http://192.168.1.100:8000
```

**Note:** Individual node configuration takes priority over environment variables. The mv-config node approach is recommended for new projects.

### Backward Compatibility

Existing flows with hardcoded `apiUrl` in individual nodes will continue to work. However, we recommend migrating to mv-config for easier management.

## Migration Guide

### Upgrading to mv-config (v1.1+)

**What Changed:**

In version 1.1.0, we introduced the **mv-config** configuration node to replace individual `apiUrl` fields in each Machine Vision node. This centralizes backend connection settings across your entire workspace.

**Before (v1.0):**
```javascript
// Each node had its own apiUrl field
{
  "type": "mv-camera-capture",
  "apiUrl": "http://localhost:8000",  // Repeated in every node
  ...
}
```

**After (v1.1+):**
```javascript
// All nodes share one mv-config node
{
  "type": "mv-camera-capture",
  "apiConfig": "config_node_id",  // Reference to shared config
  ...
}
```

### Why Migrate?

✓ **Single point of change** - Update backend URL once, affects all nodes
✓ **Environment switching** - Create separate configs for dev/staging/prod
✓ **Connection testing** - Built-in "Test Connection" validates backend health
✓ **Credentials support** - API keys and tokens managed securely
✓ **Easier troubleshooting** - Visual status indicators show connection state

### How to Migrate Existing Flows

**Option 1: Automatic (Recommended)**

1. Open your existing flow in Node-RED
2. Deploy the flow (nodes will show "no config" warning)
3. Double-click any MV node showing a warning
4. In the "API Config" dropdown, select "Add new mv-config..."
5. Configure the backend URL and click "Add"
6. Repeat step 3-4 for remaining nodes (select existing config from dropdown)
7. Deploy to save changes

**Option 2: Manual Migration**

If you prefer to update flows manually:

1. Create an mv-config node:
   - Open Node-RED palette
   - Find "mv-config" in the config section
   - Configure backend URL: `http://localhost:8000`
   - Save and note the config node ID

2. Edit your flow JSON:
   - Export your flow
   - Find all nodes with `"apiUrl": "http://localhost:8000"`
   - Replace with `"apiConfig": "your_config_node_id"`
   - Remove the old `apiUrl` field
   - Import the updated flow

### Backward Compatibility

**Important:** Existing flows continue to work without modification. Nodes will check for the new config node first, then fall back to the legacy `apiUrl` field if present.

However, we **strongly recommend migrating** to the config node approach for new and existing projects to benefit from centralized management.

### Best Practices for New Projects

1. **Create mv-config first** - Set up your backend connection before adding vision nodes
2. **Use descriptive names** - Name configs by environment: "Local Dev", "Production", "Staging"
3. **Test connection** - Always click "Test Connection" before deploying
4. **One config per environment** - Don't create multiple configs pointing to the same backend
5. **Secure credentials** - Use API Key/Token fields for authenticated backends (when available)

### Troubleshooting Migration

**"Missing API configuration" error:**
- Cause: Node has no config selected and no legacy apiUrl
- Fix: Edit node and select mv-config from dropdown

**"Connection failed" in mv-config:**
- Cause: Backend not running or wrong URL
- Fix: Check backend with `make status` and verify URL in config

**Nodes still use old apiUrl:**
- Cause: Config field not saved properly
- Fix: Re-edit each node, select config, and click "Done" (not just "Cancel")

## Troubleshooting

### Backend Connection Failed

**Error:** `ECONNREFUSED localhost:8000`

**Solution:** Ensure the Python backend is running:
```bash
cd machine-vision-flow
make status  # Check if backend is running
make start   # Start if not running
```

### Image Not Found

**Error:** `Image with ID xyz not found`

**Solution:** Images are cached with LRU eviction. Increase cache size in `python-backend/config.yaml`:
```yaml
image:
  max_images: 100
  max_memory_mb: 500
```

### Camera Access Denied

**Error:** `Failed to open camera`

**Solution:**
- Check camera permissions: `ls -l /dev/video*`
- Add user to video group: `sudo usermod -a -G video $USER`
- Reboot after group change

### Template Not Found

**Error:** `Template not found`

**Solution:** Learn templates first using the Python backend:
```bash
curl -X POST http://localhost:8000/api/template/learn \
  -F "image=@template.png" \
  -F "name=my_template"
```

## Development

### Running Tests

```bash
cd node-red
npm test
```

### Building Package

```bash
cd node-red
npm pack
# Creates node-red-contrib-machine-vision-flow-1.0.0.tgz
```

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## API Reference

### Message Format

All vision nodes use a standardized message format:

**Input:**
```javascript
msg.image_id = "550e8400-e29b-41d4-a716-446655440000"
msg.roi = { x: 100, y: 100, width: 200, height: 150 }  // Optional
```

**Output:**
```javascript
msg.payload = {
  objects: [
    {
      object_type: "template_match",
      bounding_box: { x: 120, y: 130, width: 50, height: 40 },
      center: { x: 145, y: 150 },
      confidence: 0.95,
      rotation: 45.2,  // Optional
      properties: {}   // Algorithm-specific data
    }
  ],
  thumbnail_base64: "data:image/jpeg;base64,...",
  processing_time_ms: 42
}
```

### ROI Format

```javascript
{
  x: 100,        // Top-left X coordinate
  y: 100,        // Top-left Y coordinate
  width: 200,    // ROI width
  height: 150    // ROI height
}
```

## License

MIT

## Support

- **Documentation:** https://github.com/yourusername/machine-vision-flow
- **Issues:** https://github.com/yourusername/machine-vision-flow/issues
- **Discussions:** https://github.com/yourusername/machine-vision-flow/discussions

## Credits

Inspired by industrial machine vision platforms:
- Keyence CV-X Series
- Cognex In-Sight
- HALCON Machine Vision

Built with:
- Node-RED
- FastAPI
- OpenCV
- NumPy
