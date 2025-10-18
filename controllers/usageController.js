const { default: mongoose } = require("mongoose");
const ApiFeatures = require("../lib/ApiFeatures");
const { UsageModel } = require("../mongo/models/Usage");
const { UsageHistoryModel } = require("../mongo/models/UsageHistory");

module.exports.saveUsageHandler = async (req, res) => {

    const { ip,  browser_agent, session_id } = req.body;
    const userId = req.id;


    // if there is no session_id or user_id, return an error
    if(!session_id &&!userId) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid request' });
    }

    var usage = await UsageModel.findOne({ 
        $or: [
            { session_id: session_id },
            { userId: userId }
        ]
     });
     
     if(!usage) {
        const newUsage = new UsageModel({
            ip,
            browser_agent,
            session_id,
            userId
        });
        await newUsage.save();
     } else {
        usage.browser_agent = browser_agent;
        usage.session_id = session_id;
        await usage.save();
     }

     usage = JSON.parse(JSON.stringify(usage));

     // remove _id and __v from the response
     delete usage._id;
     delete usage.__v;

     // return the usage;
     res.status(200).json(usage);


}


// All Usage History List
module.exports.getAllUsageHistory = async (req, res) => {
    try {
        const keyword = req.query.keyword
			let perPage

			if (req.query && typeof req.query.limit === 'string') {
				perPage = parseInt(req.query.limit, 10)
			}

			const count = await UsageHistoryModel.countDocuments(keyword ? { keyword } : {})

			const apiFeature = new ApiFeatures(
				UsageHistoryModel.find().select('-__v').sort({ createdAt: -1 }),
				req.query,
			)
			.search()
			.filter()

			if (perPage !== undefined) {
				apiFeature.pagination(perPage)
			}

			const result = await apiFeature.query
			const limit = result.length

			const currentPage = req.query.page
				? parseInt(req.query.page, 10)
				: 1

			let totalPages;

			if (perPage !== undefined) {
				totalPages = Math.ceil(count / perPage)
			}

			let nextPage;
			let nextUrl;

			if (perPage !== undefined && currentPage < totalPages) {
				nextPage = currentPage + 1
				nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`
			}

			res.status(200).json({
				success: true,
				data: result || [],
				total: count,
				perPage,
				limit,
				nextPage,
				nextUrl,
			})
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: "Internel server error" });
    }

}

// All Usage History List by User
module.exports.getUserUsageHistory = async (req, res) => {
    try {   
            const {id} = req.params
            const keyword = req.query.keyword
			let perPage

			if (req.query && typeof req.query.limit === 'string') {
				perPage = parseInt(req.query.limit, 10)
			}

			const count = await UsageHistoryModel.countDocuments(
                keyword 
                  ? { $and: [{ keyword }, { userId: id }] } 
                  : { userId: id }
              );
			const apiFeature = new ApiFeatures(
				UsageHistoryModel.find({userId: id}).select('-__v').sort({ createdAt: -1 }),
				req.query,
			)
			.search()
			.filter()

			if (perPage !== undefined) {
				apiFeature.pagination(perPage)
			}

			const result = await apiFeature.query
			const limit = result.length

			const currentPage = req.query.page
				? parseInt(req.query.page, 10)
				: 1

			let totalPages;

			if (perPage !== undefined) {
				totalPages = Math.ceil(count / perPage)
			}

			let nextPage;
			let nextUrl;

			if (perPage !== undefined && currentPage < totalPages) {
				nextPage = currentPage + 1
				nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`
			}

			res.status(200).json({
				success: true,
				data: result || [],
				total: count,
				perPage,
				limit,
				nextPage,
				nextUrl,
			})
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: "Internel server error" });
    }

}


// All Usage History List by User
module.exports.getUserUsageHistoryByDay = async (req, res) => {
    const { id } = req.params;
    const userId = new mongoose.Types.ObjectId(id);
    const { date, limit = 10, page = 1 } = req.query;

    const perPage = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    let dateMatch = {};

    if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);

        dateMatch = {
            createdAt: {
                $gte: startDate,
                $lt: endDate
            }
        };
    }

    try {
        const data = await UsageHistoryModel.aggregate([
            {
                $match: {
                    userId,
                    ...dateMatch
                }
            },
            {
                $group: {
                    _id: {
                        userId: '$userId',
                        package: '$package',
                        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        service: '$service'
                    },
                    totalHits: { $sum: '$hits' },
                    totalWordCount: { $sum: '$word_count' },
                    latestDate: { $max: '$createdAt' }
                }
            },
            {
                $group: {
                    _id: {
                        userId: '$_id.userId',
                        package: '$_id.package',
                        day: '$_id.day'
                    },
                    services: {
                        $push: {
                            service: '$_id.service',
                            Api_hit: '$totalHits',
                            word_count: '$totalWordCount'
                        }
                    },
                    latestDate: { $max: '$latestDate' }
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id.userId',
                    package: '$_id.package',
                    date: '$latestDate',
                    services: '$services'
                }
            },
            {
                $sort: { date: 1 }
            },
            {
                $facet: {
                    metadata: [{ $count: "total" }, { $addFields: { currentPage: currentPage } }],
                    data: [{ $skip: (currentPage - 1) * perPage }, { $limit: perPage }]
                }
            },
            {
                $unwind: "$metadata"
            },
            {
                $project: {
                    total: "$metadata.total",
                    totalPages: {
                        $ceil: {
                            $divide: ["$metadata.total", perPage]
                        }
                    },
                    currentPage: "$metadata.currentPage",
                    data: "$data"
                }
            }
        ]);

        const total = data[0].total;
        const totalPages = data[0].totalPages;
        const result = data[0].data;

        let nextPage;
        let nextUrl;

        if (currentPage < totalPages) {
            nextPage = currentPage + 1;
            nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}&date=${date}`;
        }

        res.status(200).json({
            success: true,
            data: result.map(item => ({
                userId: item.userId,
                package: item.package,
                date: item.date,
                services: item.services.map(service => ({
                    service: service.service,
                    Api_hit: service.Api_hit,
                    word_count: service.word_count
                }))
            })),
            total,
            perPage,
            limit: result.length,
            nextPage,
            nextUrl,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
