const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const DARAJA_BASE_URL =
  "https://sandbox.safaricom.co.ke";

function getTimestamp() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  return (
    year +
    month +
    day +
    hour +
    minute +
    second
  );
}


/*
   GET DARAJA ACCESS TOKEN
*/

async function getAccessToken() {

  const credentials =
    Buffer.from(
      process.env.DARAJA_CONSUMER_KEY +
      ":" +
      process.env.DARAJA_CONSUMER_SECRET
    ).toString("base64");

  const response = await fetch(
    DARAJA_BASE_URL +
    "/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: "Basic " + credentials
      }
    }
  );

  const data = await response.json();

  return data.access_token;
}


/*
   M-PESA STK PUSH
*/

app.post("/api/stkpush", async (req, res) => {

  try {

    let amount =
      Number(req.body.amount);

    let phone =
      String(req.body.phone || "")
      .replace(/\D/g, "");


    /*
       Convert 07XXXXXXXX
       to 2547XXXXXXXX
    */

    if (phone.startsWith("0")) {

      phone =
        "254" +
        phone.substring(1);

    }


    if (!amount || amount < 1) {

      return res.status(400).json({
        message:
          "Enter a valid amount."
      });

    }


    if (!/^2547\d{8}$/.test(phone)) {

      return res.status(400).json({
        message:
          "Enter a valid Kenyan M-PESA number."
      });

    }


    /*
       Check credentials
    */

    if (
      !process.env.DARAJA_CONSUMER_KEY ||
      !process.env.DARAJA_CONSUMER_SECRET ||
      !process.env.DARAJA_PASSKEY ||
      !process.env.DARAJA_CALLBACK_URL
    ) {

      return res.status(500).json({

        message:
          "Daraja sandbox credentials have not been connected yet."

      });

    }


    /*
       Get access token
    */

    const accessToken =
      await getAccessToken();


    /*
       Generate timestamp
    */

    const timestamp =
      getTimestamp();


    /*
       Generate password
    */

    const password =
      Buffer.from(

        process.env.DARAJA_SHORTCODE +
        process.env.DARAJA_PASSKEY +
        timestamp

      ).toString("base64");


    /*
       STK PUSH DATA
    */

    const stkData = {

      BusinessShortCode:
        Number(
          process.env.DARAJA_SHORTCODE
        ),

      Password:
        password,

      Timestamp:
        timestamp,

      TransactionType:
        "CustomerPayBillOnline",

      Amount:
        amount,

      PartyA:
        phone,

      PartyB:
        Number(
          process.env.DARAJA_SHORTCODE
        ),

      PhoneNumber:
        phone,

      CallBackURL:
        process.env.DARAJA_CALLBACK_URL,

      AccountReference:
        "ApexPay",

      TransactionDesc:
        "Party ticket payment"

    };


    /*
       Send request to Daraja
    */

    const response =
      await fetch(

        DARAJA_BASE_URL +
        "/mpesa/stkpush/v1/processrequest",

        {

          method: "POST",

          headers: {

            Authorization:
              "Bearer " +
              accessToken,

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify(stkData)

        }

      );


    const data =
      await response.json();


    console.log(
      "Daraja response:",
      data
    );


    /*
       Return result
    */

    res.json({

      success:
        data.ResponseCode === "0",

      message:
        data.CustomerMessage ||
        data.ResponseDescription ||
        "Payment request sent.",

      checkoutRequestID:
        data.CheckoutRequestID || null

    });


  } catch (error) {

    console.error(error);

    res.status(500).json({

      message:
        "Unable to connect to Daraja sandbox."

    });

  }

});


/*
   DARAJA CALLBACK
*/

app.post(
  "/mpesa/callback",
  (req, res) => {

    console.log(
      "M-PESA CALLBACK:"
    );

    console.log(
      JSON.stringify(
        req.body,
        null,
        2
      )
    );


    res.json({

      ResultCode: 0,

      ResultDesc:
        "Callback received successfully"

    });

  }
);


/*
   TEST SERVER
*/

app.get(
  "/health",
  (req, res) => {

    res.json({

      status: "online",

      service:
        "ApexPay Daraja Sandbox"

    });

  }
);


/*
   START SERVER
*/

app.listen(
  PORT,
  () => {

    console.log(
      "ApexPay server running on port " +
      PORT
    );

  }
);
