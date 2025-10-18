
const crypto = require('crypto');
const ApiFeatures = require('../lib/ApiFeatures');
const UserSecret = require('@ridz-shothikai/shothik-auth-service/src/models/UserSecret');
const { Transection } = require('../mongo/models/UserTransection');

// generate user secret
module.exports.generateSecretKey = async (req, res) => {
    try {
		const userId = req.id;

        // Generate a new secret key
        const randomToken = crypto.randomBytes(8).toString('hex');

        // Find or create the user secret
        let userSecret = await UserSecret.findOneAndUpdate(
            { userId },
            { secretKey: randomToken },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(201).json({success: true, data: userSecret.secretKey });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: "Internel server error" });
    }

}

// Get Secret Key Details
module.exports.getSecretKeyDetails = async (req, res) => {
    try {   
        const {key} = req.params
        const user = await UserSecret.findOne({secretKey: key}).populate({
			path: "userId",
			select: "name email package"
		}).exec();
		if(!user){
			return res.status(404).json({success: false, message: "User details not found"})
		}
		res.status(200).json({success: true, data: user });	
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: "Internel server error" });
    }

}
