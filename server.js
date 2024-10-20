import {checkforEmail as checkforEmailEversource, 
  onStart as onStartEversource,
  checknewEmail as checknewEmailEversource,
} from './modules/eversource.js'

import {checkforEmail as checkforEmailnationalGrid, 
  onStart as onStartnationalGrid,
  checknewEmail as checknewEmailnationalGrid,
} from './modules/nationalGrid.js'



import path from 'path'
import process from 'process'
import { google } from 'googleapis';
import express from 'express';
import bodyParser from 'body-parser'
import {OAuth2Client} from 'google-auth-library';
import cors from 'cors';
import twilio from 'twilio';
import dotenv from 'dotenv/config';
import { validateExpressRequest } from 'twilio/lib/webhooks/webhooks.js';
import axios from 'axios';
    

let USERINFO;
let USERSET;
let serverCredentials;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

async function START_All_Utilities() { //create new OAuth2Client for each user out of tokes stored in db

    for(let [key, value] of USERSET.entries()) { 
      //console.log(value)
      console.log('user')
      if(value.initialized) {

        if(value.toDelete == true) return

        const oAuth2Client = new OAuth2Client(
          serverCredentials.client_id,
          serverCredentials.client_secret,
          serverCredentials.redirect_uris[0]
        );
        // console.log("v1" , oAuth2Client)
        const userID = value.usersID

        axios.get(process.env.REQUEST_URL+'/startALL/'+userID, {
          headers: {
            Authorization: `Bearer ${process.env.API_KEY}`
          }
        }).then(async (response) => {

            // console.log(response.data)
            const userAuth = response.data.userAuth
            const emailIds = response.data.emailIds

              
            const credentials = {
              refresh_token: userAuth.refresh_token,
              scope: userAuth.scope,
              token_type: userAuth.token_type,
              access_token: userAuth.access_token,
              expiry_date: userAuth.expiry_date
            }
            
            oAuth2Client.setCredentials(credentials)

            // console.log("v2 ", oAuth2Client)

            let temp = value

            temp.OAuth2Client = oAuth2Client
            temp.electric = emailIds.electric
            temp.gas = emailIds.gas

           // console.log("temp", temp ,temp.OAuth2Client, temp.electric, temp.gas)
            USERSET.set(key, temp) 
        })
      
    }
  }
}

async function checkforNewUsers() {

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${process.env.API_KEY}`
    }
  });

  axios.all([
    axiosInstance.get(process.env.REQUEST_URL+'/findNewUsers'),
    axiosInstance.get(process.env.REQUEST_URL+'/usersToDelete'),
    axiosInstance.get(process.env.REQUEST_URL+'/usersToUpdate')
  ]).then(axios.spread((newUsers, deleteUsers, toUpdate ) => {

    const newUserData = newUsers.data
    if(newUserData.length > 0) {
      console.log(newUserData)
      console.log("new users")
      newUserData.forEach(user =>{
        initialize_Utility(user)
      })
    }
    
    const deleteUserData = deleteUsers.data
    if(deleteUserData != "no users to delete" && deleteUserData.length > 0) {
      deleteUserData.forEach(async user =>{
        USERSET.delete(user.usersID)
      })
    }

    const toUpdateData = toUpdate.data;
    if(toUpdateData != "no new users" && toUpdateData.length > 0) {
      console.log(toUpdateData)
      toUpdateData.forEach(async user =>{
        console.log(user.usersID)
        user.OAuth2Client = USERSET.get(user.usersID).OAuth2Client
        user.electric = USERSET.get(user.usersID).electric
        user.gas = USERSET.get(user.usersID).gas
        user.toUpdate = false
        USERSET.set(user.usersID, user)
      })
    }

  }))

}

async function initialize_Utility(e) {
      console.log(e.usersID)
      
      const oAuth2Client = new google.auth.OAuth2(
        serverCredentials.client_id,
        serverCredentials.client_secret,
        serverCredentials.redirect_uris[0]
      );

      axios.get(process.env.REQUEST_URL+'/tokenInfo/' + e.usersID, {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`
        }
      }).then(async (response) => {
         console.log(response.data)
         const userAuth = response.data

         const credentials = {
          access_token: userAuth.access_token,
          refresh_token: userAuth.refresh_token,
          scope: userAuth.scope,
          token_type: userAuth.token_type,
          expiry_date: userAuth.expiry_date}
        
          oAuth2Client.setCredentials(credentials)
    
          // Grab newest email from both catagories
          const eversource = await onStartEversource(oAuth2Client)
          const nationalgrid = await onStartnationalGrid(oAuth2Client)
    
          axios.post(process.env.REQUEST_URL+'/newEmails/' + e.usersID,
            { eversource: eversource, nationalgrid: nationalgrid, currentGasPayment: '', currentElectricPayment: '', gasDate: '', electricDate: ''},
            { headers: {
              Authorization: `Bearer ${process.env.API_KEY}`
            }
          }).then((response) => {
            console.log(response.data)
          })
    
          axios.post(process.env.REQUEST_URL+'/userisInitalized/' + e.usersID,{} ,{
            headers: {
              Authorization: `Bearer ${process.env.API_KEY}`
            }
          }).then((response) => {
              console.log(response.data)
          })
    
    
          e.OAuth2Client = oAuth2Client
          e.electric = eversource
          e.gas = nationalgrid
          e.initialized = true
    
          USERSET.set(e.usersID, e)   

      })
}



async function check_All_Utilities() {
  for(const [key, e] of  USERSET.entries()) {

    if(e.initialized && e.OAuth2Client) {
      const usersID = e.usersID

      let x = Date.now()      

      //Check for new utilties email
      let electricity;
      switch(e.electricProvider){
        case "eversource":
          console.log("test")
          electricity = await checknewEmailEversource(e.OAuth2Client, e.electric)
        default:
      }
      
      let gas;
      switch(e.gasProvider){
        case "National Grid":
          // console.log("auth shit" , e.OAuth2Client);
          gas = await checknewEmailnationalGrid(e.OAuth2Client, e.gas)
        default:
      }
      //-----------------------

      console.log(Date.now()-x)
      console.log("we have info?" + JSON.stringify(gas) + " " + JSON.stringify(electricity) + " ")

      let body;

      //Make calls to update current email id for combo of bills that are new
      if(gas !== undefined && electricity !== undefined) {
        e.electric = electricity.id
        e.gas = gas.id
        body = {
          gas: gas.id, 
          electric: electricity.id,
          currentGasPayment: gas.balance,
          curentElectricPayment: electricity.balance,
          gasDate: Date.now().toString(),
          electricDate: Date.now().toString() 
        }
      }
      else if (gas !== undefined && electricity === undefined) {
        e.gas = gas.id
        body = {
          gas: gas.id,
          currentGasPayment: gas.balance,
          gasDate: Date.now()
        }
      }
      else if (gas === undefined && electricity !== undefined) {        
        e.electric = electricity.id
        body = {
            electric: electricity.id, 
            curentElectricPayment:electricity.balance,
            electricDate:  Date.now()
        }
      }
      //---------------------
      
      axios.post(process.env.REQUEST_URL+'/newEmails/' + e.usersID, body,
      {headers: {
        Authorization: `Bearer ${process.env.API_KEY}`
      }
      }).then((response) => {
          console.log(response.data)
          requestMoney(e.expoPushToken)

      })
    }
  }
}

function requestMoney(expoPushToken){
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'New Utilities Bill',
    body: 'Click here to request your roommates for your bills!',
    data: { someData: 'goes here' }, //figure this out 
  };

  axios.post('https://exp.host/--/api/v2/push/send', JSON.stringify(message), {
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
  });
}

function twilioCall(usersPhoneNumber, total, roommates){
  console.log("sending text for:" )
  const perPerson = total / (roommates.length+1)
  console.log(perPerson)
  client.messages.create({body:`Total Utilities is ${total} with a amount of ${perPerson} per person`, from: '+18339653250',
  to: usersPhoneNumber}).then(message => console.log(message.sid));

  roommates.forEach(e => {
      client.messages
        .create({
          body: `Total Utiltiies is ${total} with a amount of ${perPerson} per person`,
          from: '+18339653250',
          to: e
        })
        .then(message => console.log(message.sid));
  })
}

const corsOptions = {
  origin: '*',
  credentials: true,            //access-control-allow-credentials:true
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

  const app = express();

  app.use(bodyParser.json()); // <--- Here
  app.use(cors(corsOptions))

  const PORT = process.env.PORT || 8080;

  app.listen(PORT, async () => {
      console.log('listening on ' + PORT)
      console.log("test")
      serverCredentials = JSON.parse(process.env.KEY)

      axios.get(process.env.REQUEST_URL+'/users', {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`
        }
      }).then(async (response) => {
        // console.log(response.data)
        USERINFO = response.data
        USERSET = new Map(USERINFO.map(info => [info.usersID, info]))
        await START_All_Utilities()
        .then(() => {
          setInterval(() => {
              check_All_Utilities()
              try{
                checkforNewUsers()
              } catch (e) {
                console.log(e)
              }
            }
          , 6000)
       })
      })

    })