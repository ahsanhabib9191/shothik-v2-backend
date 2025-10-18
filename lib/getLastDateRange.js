const getLastDateRange = (interval) => {
    const today = new Date();
    let startDate, endDate;
    today.setHours(0, 0, 0, 0);

    switch (interval) {
        case 'last7days':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'lastmonth':
            startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - 1);
            startDate.setDate(1);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'lastyear':
            startDate = new Date(today);
            startDate.setFullYear(startDate.getFullYear() - 1);
            startDate.setMonth(0);
            startDate.setDate(1);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
    }

    return { startDate, endDate };
};

module.exports = {
    getLastDateRange
};
