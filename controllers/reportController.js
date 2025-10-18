
const { default: mongoose } = require('mongoose');
const Report = require('../mongo/models/Report');
const ApiFeatures = require('../lib/ApiFeatures');

// Create Report
module.exports.createReport = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id)

    const { input, output, type } = req.body;

    const report = await Report.create({ user: userId, input, output, type });

    res.json({
        success: true,
        message: "Report send successfully",
        data: report
    });

}

// Report List
module.exports.getReports = async (req, res) => {
    try {
        const { keyword } = req.query;
        let perPage;

        if (req.query && typeof req.query.limit === 'string') {
            perPage = parseInt(req.query.limit, 10);
        }

        // Construct the search criteria
        const searchCriteria = {};
        if (keyword) {
            searchCriteria.keyword = keyword;
        }

        const count = await Report.countDocuments(searchCriteria);

        const apiFeature = new ApiFeatures(
            Report.find(searchCriteria).sort({ createdAt: -1 }),
            req.query,
        )
            .search()
            .filter();

        if (perPage !== undefined) {
            apiFeature.pagination(perPage);
        }

        const result = await apiFeature.query;
        const limit = result.length;

        const currentPage = req.query.page
            ? parseInt(req.query.page, 10)
            : 1;

        let totalPages;

        if (perPage !== undefined) {
            totalPages = Math.ceil(count / perPage);
        }

        let nextPage;
        let nextUrl;

        if (perPage !== undefined && currentPage < totalPages) {
            nextPage = currentPage + 1;
            nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
            if (keyword) {
                nextUrl += `&keyword=${keyword}`;
            }
        }

        res.status(200).json({
            success: true,
            data: result || [],
            total: count,
            perPage,
            limit,
            nextPage,
            nextUrl,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

// Delete report
module.exports.deleteReport = async (req, res) => {
    try {
        const reportId = new mongoose.Types.ObjectId(req.params.id)

        await Report.findOneAndDelete(reportId)

        res.json({
            success: true,
            message: "Report delete successfully",
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}