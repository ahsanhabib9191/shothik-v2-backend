const mongoose = require("mongoose");
const { createPayment , createPaymentForRider} = require("../action/createPayment.js");
const executePayment = require("../action/executePayment.js");
const queryPayment = require("../action/queryPayment.js");
const searchTransaction = require("../action/searchTransaction.js");
const refundTransaction = require("../action/refundTransaction.js");
const { bkashConfig } = require("../config/bkashConfig.js");
const { Moment } = require("../lib/moment.js");
const { log } = require("../lib/log.js");
// const { User } = require("../mongo/models/User.js"); // TODO: Update this import path and use the User model from SHOTHIK auth package
const {
  User
} = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const { Transection } = require("../mongo/models/UserTransection.js");
const { Pricing } = require("../mongo/models/Pricing.js");

const checkout = async (req, res) => {
     // if app then add userID
     const { pricingId } = req.body; 

    const pricingID = new mongoose.Types.ObjectId(pricingId);
    if(!pricingID) {
        throw Error('pricing id is required');
    }

    const existPricing = await Pricing.findById(pricingID)
     
     if(!existPricing){
      throw Error('Pricing is invalid');
     }


     req.body.package =  existPricing?.type;
     req.body.user = req.user;
     
     const createResult = await createPayment(req.body, req.id);
     res.json(createResult);
};

const bkashCallback = async (req, res) => {

  try {

    if (req.query.status === "success") {
      let response = await executePayment(req.query.paymentID);
      if (response.message) {
        response = await queryPayment(req.query.paymentID);
      }

      if (response.statusCode && response.statusCode === '0000') {
        
        const query = req.query;
        
        const transection = await Transection.findOne({ _id:query.tranx_id });
        if(transection){

          transection.status = 'success';
          transection.payload = response;
          transection.save();
          const user = await User.findOne({ _id: String(transection.userId) });
          if(user){
            user.package = transection.package;
            user.save();
          }
        }

        // upgrade user to desire account
       
        
      } else {

       // failed
        return res.redirect(`${bkashConfig.frontend_fail_url}?data=${response.statusMessage}`);
      }

      // Your frontend success route
      return res.redirect(`${bkashConfig.frontend_success_url}?data=${response.statusMessage}`);;

    } else {
      
      // Your frontend failed route
      res.redirect(bkashConfig.frontend_fail_url);
    }

  } catch (e) {
    log(e);
  }
};

const search = async (req, res) => {
  try {
    res.send(await searchTransaction(req.body.trxID));
  } catch (e) {
    log(e);
  }
};

const refund = async (req, res) => {
  try {
    res.send(await refundTransaction(req.body));
  } catch (e) {
    log(e);
  }
};

const refundStatus = async (req, res) => {
  try {
    res.send(await refundTransaction(req.body));
  } catch (e) {
    log(e);
  }
};





// Rider Checkout =======================================================================
// Rider Checkout =======================================================================
// Rider Checkout =======================================================================
// Rider Checkout =======================================================================



const RiderCheckout = async (req, res) => {
  try {

    // check if device is app or other

    log('Bkash Payment Initialized')

    // if app then add userID
    const { amount, rider_id } = req.body;
      riderPaymentFirebaseNotify({
        userId: rider_id,
        status: "initiated",
        from: "Rider Payment API"
      })

    const createResult = await createPaymentForRider(req.body, { amount, rider_id });

    res.json(createResult);
  } catch (e) {
    log(e);
  }
};




// Rider Payment Callback



const RiderCheckoutCallBack = async (req, res) => {




  try {

    

      let response = await executePayment(req?.query?.paymentID);
      if (response.message) {
        response = await queryPayment(req.query.paymentID);
      }



      
      if (response.statusCode && response.statusCode === '0000') {
        log("Payment Successful !!! ");
        const rider_id = req.query.rider_id;

        if (rider_id) {

          // Notify to firebase that payment is success
          const RiderTransection = db.RiderTransection;
          await RiderTransection.create({
              rider_id: rider_id,
              type:"payment",
              createdAt: Moment(),
              status:"success",
              files:"",
              amount: response?.amount,
          });
          
          riderPaymentFirebaseNotify({
            userId: rider_id,
            status: "success",
            from: "Rider Payment Callback API and ORDER ID available Order Found"
          });

          return res.send(`${html({ color: 'green', message: 'Payment Success. You can Close the window' })}`)
        }

        
      } else {

        riderPaymentFirebaseNotify({
          userId: req?.query?.user_id,
          status: "failed",
          from: "bkashCallback API and Failed Payment"
        })
        
        return res.send(`${html({ color: 'red', message: response?.statusMessage ?? 'Payment Failed' })}`)
      }


  } catch (e) {
    log(e);
  }
};




function html({ color, message }){
  return `
  
  <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                /* Card styles */
                .card {
                    width: 300px;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 10px;
                    text-align: center;
                    margin: 50px auto;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }

                /* Message styles */
                h1 {
                    font-size: 40px;
                    color: ${color};
                    margin: 0;
                }
            </style>
        </head>
        <body>

            <div class="card">
                <h1>${message}</h1>
            </div>

        </body>
        </html>
  `
}



module.exports = {
  checkout,
  bkashCallback,
  search,
  refund,
  refundStatus,
  
  // Rider Payment 
  RiderCheckout,
  RiderCheckoutCallBack
};
