const { Transection } = require("../mongo/models/UserTransection")

module.exports.tranSectionHistory = async function (req, res, next){

    // console.log(req.user);
    // return res.json({})

    const { id }= req;
    const transections =  await Transection.find({ userId: id, status: { $ne: 'pending' } }).select("-payload -userId -__v");

    return res.json(transections);
}