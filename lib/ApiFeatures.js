class ApiFeatures {
    constructor(query, queryStr) {
      this.query = query
      this.queryStr = queryStr
    }
  
    search() {
      const keyword = this.queryStr.keyword
        ? {
            name: {
              $regex: this.queryStr.keyword,
              $options: 'i',
            },
          }
        : {}
  
      this.query = this.query.find({ ...keyword })
      return this
    }
  
    filter() {
      const queryCopy = { ...this.queryStr }
      const removeFields = ['keyword', 'page', 'limit']
      removeFields.forEach((key) => delete queryCopy[key])
  
      let priceQuery = {} // Initialize an empty price query
  
      if (queryCopy.price && (queryCopy.price.gte || queryCopy.price.lte)) {
        const { price } = queryCopy
        priceQuery = {
          price: {},
        }
        if (price.gte) {
          priceQuery.price.$gte = price.gte
        }
        if (price.lte) {
          priceQuery.price.$lte = price.lte
        }
        delete queryCopy.price // Remove price from the queryCopy
      }
  
      if (queryCopy.categoryInfo) {
        const categoryQuery = {}
  
        if (queryCopy.categoryInfo.categoryID) {
          categoryQuery['categoryInfo.categoryID']
          queryCopy.categoryInfo.categoryID
        }
  
        if (queryCopy.categoryInfo.category) {
          categoryQuery['categoryInfo.category'] = queryCopy.categoryInfo.category
        }
  
        delete queryCopy.categoryInfo
  
        this.query = this.query.find({ ...queryCopy, ...categoryQuery })
      } else {
        this.query = this.query.find(queryCopy)
      }
  
      //for price//
      this.query = this.query.find({ ...queryCopy, ...priceQuery })
  
      return this
    }
  
    pagination(resultPerPage) {
      const currentPage = Number(this.queryStr.page) || 1
      const skip = resultPerPage * (currentPage - 1)
  
      this.query = this.query.limit(resultPerPage).skip(skip)
      return this
    }
  
    //   async queryResults() {
    //     const products = await this.query;
    //     return products;
    //   }
  }
  
  module.exports = ApiFeatures