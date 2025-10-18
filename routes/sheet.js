const express = require('express');
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const rateLimit = require("express-rate-limit");
// const {auth} = require("../middleware/auth");
const { auth } = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const SheetAiService = require('../services/sheetAiService');
const { body, param, validationResult } = require('express-validator');

// Initialize Sheet AI service
const sheetAiService = new SheetAiService();

// Rate limiting configurations
const standardLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 250,
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const streamingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // More restrictive for streaming endpoints
  message: "Too many streaming requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation middleware
// const validateInput = (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({
//       success: false,
//       error: 'Validation failed',
//       details: errors.array()
//     });
//   }
//   next();
// };

// Error handler middleware
const handleServiceResponse = (serviceResponse, res) => {
    if (serviceResponse.success) {
        return res.status(serviceResponse.status || 200).json({
            success: true,
            data: serviceResponse.data,
            fromCache: serviceResponse.fromCache || false
        });
    } else {
        return res.status(serviceResponse.status || 500).json({
            success: false,
            error: serviceResponse.error || 'Internal server error'
        });
    }
};

// Apply standard rate limiting to all routes
router.use(standardLimiter);
router.use(auth);

// Authentication routes
router.post('/auth/register',
    AsyncHandler(async (req, res) => {
        try {
            const { name, email } = req.body;
            
            const result = await sheetAiService.registerToSheetAi(name, email);
            handleServiceResponse(result, res);
        } catch (error) {
            console.error('Sheet AI register error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

router.post('/auth/login',
    AsyncHandler(async (req, res) => {
        try {
            const { email } = req.body;
            
            const result = await sheetAiService.loginToSheetAi(email);
            handleServiceResponse(result, res);
        } catch (error) {
            console.error('Sheet AI login error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

router.post("/register-sheet-service", AsyncHandler (async (req, res) => {
    try {
        const {email, name} = req.body;

        const result = await sheetAiService.registerSheetService(email, name);
        
        res.send(result);
        // handleServiceResponse(result, res);
    } catch (error) {
        console.error("Sheet AI service error when trying to authenticated:", error);
        res.status(500).json({
          success: false,
          error: "Internal server error",
        });
    }
}));

// Chat management routes
router.post('/chat/create',
    AsyncHandler(async (req, res) => {
        try {
            const { name, userEmail } = req.body;
            const sheetAiToken = req.headers['x-sheetai-token'];
            // console.log(sheetAiToken, "headers");
            const userId = req.id;

            console.log(userId, "user Id");
            
            const result = await sheetAiService.createChat(userId, name, userEmail,undefined, sheetAiToken); // don't need to override the default password so giving undefined.
            handleServiceResponse(result, res);
        } catch (error) {
            console.error('Create chat error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

router.get('/chat/my-chats',
    AsyncHandler(async (req, res) => {
        try {
            const { userEmail } = req.body;
            const userId = req.id;
            
            const result = await sheetAiService.getMyChats(userId, userEmail);
            handleServiceResponse(result, res);
        } catch (error) {
            console.error('Get chats error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

router.delete('/chat/:chatId',
    AsyncHandler(async (req, res) => {
        try {
            const { chatId } = req.params;
            const userId = req.id;
            
            const result = await sheetAiService.deleteChat(userId, chatId);
            handleServiceResponse(result, res);
        } catch (error) {
            console.error('Delete chat error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

// Conversation routes with SSE support
router.post('/conversation/create-stream',
    AsyncHandler(async (req, res) => {
        try {
            const { chatId, prompt, userEmail } = req.body;
            const userId = req.id;

            // console.log(userId, "user id from create-stream");
            
            // Set SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control, Authorization, Content-Type'
            });

            // Send initial connection confirmation
            res.write(`data: ${JSON.stringify({ 
                type: 'connection', 
                message: 'Connected to Sheet AI stream',
                timestamp: Date.now()
            })}\n\n`);

            // Handle client disconnect
            req.on('close', () => {
                console.log('Client disconnected from Sheet AI SSE stream');
                res.end();
            });

            req.on('error', (error) => {
                console.error('SSE request error:', error);
                res.write(`data: ${JSON.stringify({ 
                    type: 'error', 
                    error: 'Connection error' 
                })}\n\n`);
                res.end();
            });

            // Start streaming conversation
            await sheetAiService.createConversationWithStreaming(
                userId, 
                chatId, 
                prompt, 
                userEmail, 
                res
            );

            // if (!result.success) {
            //     res.write(`data: ${JSON.stringify({ 
            //         type: 'error', 
            //         error: result.error 
            //     })}\n\n`);
            //     res.end();
            // }

        } catch (error) {
            console.error('Create streaming conversation error:', error);
            res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                error: 'Internal server error' 
            })}\n\n`);
            res.end();
        }
    })
);

router.get('/conversation/:chatId',
    AsyncHandler(async (req, res) => {
        try {
            const { chatId } = req.params;
            const { userEmail } = req.body;
            const userId = req.id;
            
            const result = await sheetAiService.getChatConversations(
                userId, 
                chatId, 
                userEmail
            );
            handleServiceResponse(result, res);
        } catch (error) {
            console.error('Get conversations error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

// Get specific conversation details
router.get('/conversation/details/:conversationId',
    AsyncHandler(async (req, res) => {
        try {
            const { conversationId } = req.params;
            const userId = req.id;
            
            const conversation = await SheetAiConversations.findOne({
                _id: conversationId,
                userId
            });
            
            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversation not found'
                });
            }
            
            res.json({
                success: true,
                data: conversation
            });
        } catch (error) {
            console.error('Get conversation details error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

// Stop/Cancel streaming conversation
router.post('/conversation/stop/:conversationId',
    AsyncHandler(async (req, res) => {
        try {
            const { conversationId } = req.params;
            const userId = req.id;
            
            // Update conversation status to cancelled
            const updated = await SheetAiConversations.findOneAndUpdate(
                { _id: conversationId, userId },
                { 
                    status: 'cancelled',
                    'response.status': 'cancelled' 
                },
                { new: true }
            );
            
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversation not found'
                });
            }
            
            res.json({
                success: true,
                data: { message: 'Conversation cancelled' }
            });
        } catch (error) {
            console.error('Stop conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

// Utility routes
router.get('/health',
    AsyncHandler(async (req, res) => {
        try {
            const result = await sheetAiService.healthCheck();
            res.status(result.success ? 200 : 503).json(result);
        } catch (error) {
            console.error('Health check error:', error);
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                error: 'Health check failed'
            });
        }
    })
);

router.post('/auth/clear-cache',
    AsyncHandler(async (req, res) => {
        try {
            const userId = req.id;
            await sheetAiService.clearUserTokenCache(userId);
            
            res.json({
                success: true,
                message: 'Cache cleared successfully'
            });
        } catch (error) {
            console.error('Clear cache error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    })
);

module.exports = router;