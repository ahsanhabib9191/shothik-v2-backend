const express = require("express");
const { AddPricing, PricingList, PricingEdit, PricingDelete, addPricingFeature, PricingFeatureDelete, PricingFeatureList, PricingFeatureFullDelete, PricingFeatureEdit } = require("../controllers/Pricing");
const router = express.Router();
const AsyncHandler = require("express-async-handler");

router.get("/", (req, res) => {
    res.json({
        message: "Hello World udpated !!!",
    });
});


// pricing add 
router.post('/add', AsyncHandler(AddPricing))

// pricing list
router.get('/list', AsyncHandler(PricingList))

// pricing edit
router.post('/edit/:id', AsyncHandler(PricingEdit))

// pricing delete
router.delete('/delete/:id', AsyncHandler(PricingDelete))

// pricing features add
router.post('/feature/add', AsyncHandler(addPricingFeature))

// pricing features list
router.get('/feature/list', AsyncHandler(PricingFeatureList));

// pricing features delete
router.delete('/feature/delete/:id', AsyncHandler(PricingFeatureDelete));

// pricing features full delete
router.delete('/feature/full/delete/:id', AsyncHandler(PricingFeatureFullDelete));

// pricing features full delete
router.put('/feature/edit/:id', AsyncHandler(PricingFeatureEdit));


  
// export router
module.exports = router;
