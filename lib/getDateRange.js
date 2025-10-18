const getDateRange = (interval, specificMonth, specificYear) => {
  const today = new Date();
  let startDate, endDate;

  endDate = new Date(today);

  switch (interval) {
    case "weekly":
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      break;
    case "monthly":
      const month =
        specificMonth !== undefined ? specificMonth : today.getMonth();
      const yearOfMonth =
        specificYear !== undefined ? specificYear : today.getFullYear();
      startDate = new Date(yearOfMonth, month, 1);
      endDate = new Date(yearOfMonth, month + 1, 0);
      break;
    case "yearly":
      const year =
        specificYear !== undefined ? specificYear : today.getFullYear();
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      break;
    default:
      throw new Error("Invalid interval");
  }

  // Adjust the endDate for monthly and yearly intervals to today if needed
  if (interval !== "weekly") {
    endDate = new Date(today);
  }

  return {startDate, endDate};
};

module.exports = {
  getDateRange,
};
