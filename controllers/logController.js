const ApiFeatures = require("../lib/ApiFeatures");
const { ErrorLogs } = require("../mongo/models/ErrorLogs");

module.exports.getErrorLogs = async (req, res) => {
    try {
        const { keyword, source } = req.query;
        let perPage;

        if (req.query && typeof req.query.limit === 'string') {
            perPage = parseInt(req.query.limit, 10);
        }

        // Construct the search criteria
        const searchCriteria = {};
        if (keyword) {
            searchCriteria.keyword = keyword;
        }
        if (source) {
            searchCriteria.source = source;
        }

        const count = await ErrorLogs.countDocuments(searchCriteria);

        const apiFeature = new ApiFeatures(
            ErrorLogs.find(searchCriteria).select('-__v').sort({ createdAt: -1 }),
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
            if (source) {
                nextUrl += `&source=${source}`;
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
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};