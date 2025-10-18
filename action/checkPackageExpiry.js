const { Transection } = require('../mongo/models/UserTransection');
const { saveSubscribeLogs } = require('../mongo/models/SubscribeLogs');
const { User } = require('@ridz-shothikai/shothik-auth-service/src/models/User');

const checkPackageExpiry = async () => {
    const currentDate = new Date();
    try {
        const users = await User.find({ package: { $ne: 'free' } });

        for (let user of users) {
            const transections = await Transection.find({ userId: user._id, status: { $ne: 'pending' } }).select("-payload -userId -__v");

            if (!transections || transections.length === 0) {
                console.log("No transactions found");
                continue;
            }

            const latestTransaction = transections[transections.length - 1];
            const validTilDate = new Date(latestTransaction.validTil);

            if (currentDate > validTilDate) {
                console.log(user, latestTransaction, currentDate > validTilDate);
                user.package = 'free';
                await user.save();
                await saveSubscribeLogs({
                    user: user._id,
                    transection: latestTransaction._id,
                    status: 'success',
                    message: `${user.email} package update success`
                });
            }
        }
        console.log('User packages updated successfully');
    } catch (error) {
        await saveSubscribeLogs({
            status: 'failed',
            message: `${error.message} failed at time ${currentDate}`,
            payload: error
        });
        console.error(error.message);
    }
};


module.exports = { checkPackageExpiry };
