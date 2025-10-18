const { handleScalewayStream, scalewayClient } = require('../controllers/research/scaleway');
const { expect } = require('chai');
const sinon = require('sinon');
const { tavily } = require('@tavily/core');

describe('Scaleway Integration Tests', () => {
    let tavilyStub;

    beforeEach(() => {
        // Reset all stubs before each test
        tavilyStub = sinon.stub();
    });

    afterEach(() => {
        // Restore all stubs after each test
        sinon.restore();
    });

    describe('handleScalewayStream', () => {
        it('should handle basic text query successfully', async () => {
            const messages = [{ role: 'user', content: 'What is artificial intelligence?' }];
            const stream = await handleScalewayStream(messages);
            expect(stream).to.exist;
            expect(stream.body).to.exist;
            expect(typeof stream.body.getReader).to.equal('function');
        });

        it('should handle web search tool calls', async () => {
            const mockSearchResults = {
                results: [
                    {
                        url: 'https://example.com',
                        title: 'Test Title',
                        content: 'Test Content',
                        raw_content: 'Test Raw Content'
                    }
                ],
                images: [
                    {
                        url: 'https://example.com/image.jpg',
                        description: 'Test Image'
                    }
                ]
            };

            sinon.stub(tavily.prototype, 'search').resolves(mockSearchResults);

            const messages = [{
                role: 'user',
                content: 'Search for recent AI developments'
            }];

            const stream = await handleScalewayStream(messages);
            expect(stream).to.exist;
        });

        it('should handle empty search results gracefully', async () => {
            sinon.stub(tavily.prototype, 'search').resolves({
                results: [],
                images: []
            });

            const messages = [{
                role: 'user',
                content: 'Search for non-existent topic'
            }];

            const stream = await handleScalewayStream(messages);
            expect(stream).to.exist;
        });

        it('should handle image validation', async () => {
            const mockSearchResults = {
                results: [],
                images: [
                    {
                        url: 'https://example.com/valid.jpg',
                        description: 'Valid Image'
                    },
                    {
                        url: 'https://example.com/invalid.jpg',
                        description: 'Invalid Image'
                    }
                ]
            };

            sinon.stub(tavily.prototype, 'search').resolves(mockSearchResults);

            // Mock fetch for image validation
            global.fetch = sinon.stub();
            global.fetch
                .withArgs('https://example.com/valid.jpg')
                .resolves({
                    ok: true,
                    headers: new Map([['content-type', 'image/jpeg']])
                })
                .withArgs('https://example.com/invalid.jpg')
                .resolves({
                    ok: false
                });

            const messages = [{
                role: 'user',
                content: 'Search for images'
            }];

            const stream = await handleScalewayStream(messages);
            expect(stream).to.exist;
        });

        it('should handle errors gracefully', async () => {
            sinon.stub(tavily.prototype, 'search').rejects(new Error('API Error'));

            const messages = [{
                role: 'user',
                content: 'Search with error'
            }];

            try {
                await handleScalewayStream(messages);
            } catch (error) {
                expect(error).to.exist;
                expect(error.message).to.include('API Error');
            }
        });
    });

    describe('URL Utilities', () => {
        it('should sanitize URLs correctly', () => {
            const url = 'https://example.com/test image.jpg';
            const sanitized = sanitizeUrl(url);
            expect(sanitized).to.equal('https://example.com/test%20image.jpg');
        });

        it('should extract domains correctly', () => {
            const url = 'https://example.com/path?query=1';
            const domain = extractDomain(url);
            expect(domain).to.equal('example.com');
        });

        it('should deduplicate results correctly', () => {
            const items = [
                { url: 'https://example.com/1' },
                { url: 'https://example.com/2' },
                { url: 'https://example.com/1' } // Duplicate
            ];

            const deduplicated = deduplicateByDomainAndUrl(items);
            expect(deduplicated).to.have.lengthOf(1);
        });
    });
});