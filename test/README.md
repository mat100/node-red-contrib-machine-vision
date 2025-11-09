# Machine Vision Node-RED Tests

This directory contains comprehensive tests for the machine vision Node-RED package.

## Test Structure

```
test/
├── unit/              # Unit tests for utilities and libraries
│   ├── constants.test.js      # Tests for constants.js
│   ├── validation.test.js     # Tests for validation utilities
│   └── vision-utils.test.js   # Tests for vision-utils.js
└── integration/       # Integration tests for nodes (TODO)
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run with coverage
```bash
npm run test:coverage
```

### Run in watch mode
```bash
npm run test:watch
```

### Run specific test file
```bash
npx mocha test/unit/validation.test.js
```

## Test Coverage

Current coverage targets:
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

View HTML coverage report after running tests with coverage:
```bash
open coverage/index.html
```

## Writing Tests

### Unit Tests

Unit tests focus on testing individual functions in isolation:

```javascript
const { expect } = require('chai');
const visionUtils = require('../../nodes/lib/vision-utils');

describe('myFunction', function() {
    it('should do something', function() {
        const result = visionUtils.myFunction(input);
        expect(result).to.equal(expected);
    });
});
```

### Integration Tests

Integration tests use `node-red-node-test-helper` to test complete nodes:

```javascript
const helper = require('node-red-node-test-helper');
const myNode = require('../../nodes/vision/my-node.js');

describe('my-node', function() {
    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload();
        helper.stopServer(done);
    });

    it('should process message', function(done) {
        const flow = [/* flow definition */];
        helper.load(myNode, flow, function() {
            // Test the node
            done();
        });
    });
});
```

## Debugging Tests

Enable debug logging:
```bash
MV_DEBUG=true npm test
```

Run single test with verbose output:
```bash
npx mocha test/unit/validation.test.js --grep "validateROI"
```

## Mocking

### Mock API calls
```javascript
const nock = require('nock');

nock('http://localhost:8000')
    .post('/api/camera/capture')
    .reply(200, { success: true, image_id: 'test123' });
```

### Mock Node-RED node
```javascript
const sinon = require('sinon');

const mockNode = {
    status: sinon.stub(),
    error: sinon.stub(),
    log: sinon.stub()
};
```

## Test Data

Use realistic test data that matches the API responses:

```javascript
const testImageId = 'abc123def456789';
const testROI = { x: 10, y: 20, width: 100, height: 200 };
const testVisionObject = {
    object_id: 'img_abc123de',
    object_type: 'camera_capture',
    image_id: testImageId,
    // ...
};
```

## Continuous Integration

Tests are automatically run on:
- Pre-commit (TODO: add git hooks)
- Pull requests (TODO: add CI config)
- Before publishing to npm

## Best Practices

1. **Test one thing at a time** - Each test should verify a single behavior
2. **Use descriptive test names** - "should reject ROI with negative x"
3. **Arrange-Act-Assert** - Set up, execute, verify
4. **Clean up after tests** - Use beforeEach/afterEach hooks
5. **Mock external dependencies** - Don't call real APIs in tests
6. **Test edge cases** - null, undefined, empty strings, boundary values
7. **Test error conditions** - Verify error handling works correctly

## Coverage Report

After running `npm run test:coverage`, you'll see a summary like:

```
------------------------|---------|----------|---------|---------|
File                    | % Stmts | % Branch | % Funcs | % Lines |
------------------------|---------|----------|---------|---------|
All files               |   XX.XX |    XX.XX |   XX.XX |   XX.XX |
 lib                    |  100.00 |   100.00 |  100.00 |  100.00 |
  constants.js          |  100.00 |   100.00 |  100.00 |  100.00 |
  vision-utils.js       |   XX.XX |    XX.XX |   XX.XX |   XX.XX |
------------------------|---------|----------|---------|---------|
```

HTML report with line-by-line coverage is in `coverage/index.html`.

## Common Issues

### "Module not found"
Make sure you're running tests from the package root directory.

### "Timeout exceeded"
Some tests (like rate limiting) need time to execute. Adjust timeout in .mocharc.json if needed.

### "Port already in use"
If integration tests fail, make sure no other Node-RED instance is running.

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain or improve coverage percentage
4. Update this README if adding new test patterns
